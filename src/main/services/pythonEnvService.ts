import { app, BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import { pythonLogger } from '../utils/logger'

const execAsync = promisify(exec)
const access = promisify(fs.access)
const mkdir = promisify(fs.mkdir)
const writeFile = promisify(fs.writeFile)

export interface VenvStatus {
  exists: boolean
  hasOcrmypdf: boolean
  ocrmypdfVersion?: string
  error?: string
}

export interface CommandResult {
  success: boolean
  stdout?: string
  stderr?: string
  error?: string
}

class PythonEnvService {
  private venvPath: string
  private pythonExecutable: string
  private ocrmypdfExecutable: string

  constructor() {
    // Store venv in Documents/Panopticon/panopticon-python/.venv
    const documentsPath = app.getPath('documents')
    const pythonFolder = path.join(documentsPath, 'Panopticon', 'panopticon-python')
    this.venvPath = path.join(pythonFolder, '.venv')

    // Platform-specific executable paths
    const isWindows = process.platform === 'win32'
    const scriptsDir = isWindows ? 'Scripts' : 'bin'
    const exeExt = isWindows ? '.exe' : ''

    this.pythonExecutable = path.join(this.venvPath, scriptsDir, `python${exeExt}`)
    this.ocrmypdfExecutable = path.join(this.venvPath, scriptsDir, `ocrmypdf${exeExt}`)
  }

  /**
   * Send progress update to renderer process
   */
  private sendProgress(message: string): void {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      windows[0].webContents.send('python:setup-progress', message)
    }
    pythonLogger.info(message)
  }

  /**
   * Get the venv path
   */
  getVenvPath(): string {
    return this.venvPath
  }

  /**
   * Check if virtual environment exists and has ocrmypdf installed
   */
  async checkVenvStatus(): Promise<VenvStatus> {
    try {
      // Check if venv directory exists
      await access(this.venvPath, fs.constants.F_OK)

      // Check if Python executable exists
      await access(this.pythonExecutable, fs.constants.F_OK)

      // Check if ocrmypdf is installed using venv's Python
      try {
        const { stdout } = await execAsync(`"${this.pythonExecutable}" -m pip show ocrmypdf`)
        const versionMatch = stdout.match(/Version: (.+)/)
        const version = versionMatch ? versionMatch[1].trim() : undefined

        return {
          exists: true,
          hasOcrmypdf: true,
          ocrmypdfVersion: version
        }
      } catch (pipError) {
        // Venv exists but ocrmypdf not installed
        return {
          exists: true,
          hasOcrmypdf: false
        }
      }
    } catch (error) {
      // Venv doesn't exist
      return {
        exists: false,
        hasOcrmypdf: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Create a new virtual environment
   */
  async createVenv(): Promise<CommandResult> {
    try {
      console.log('Creating virtual environment at:', this.venvPath)

      // Ensure parent directory exists
      const parentDir = path.dirname(this.venvPath)
      await mkdir(parentDir, { recursive: true })

      // Create venv using python -m venv with clear output
      const { stdout, stderr } = await execAsync(`python -m venv "${this.venvPath}"`, {
        maxBuffer: 5 * 1024 * 1024 // 5MB buffer
      })

      // Verify the venv was created successfully
      await access(this.pythonExecutable, fs.constants.F_OK)

      // Create extract_pdf_text.py in the venv parent directory
      await this.createExtractScript()

      console.log('Virtual environment created successfully')
      return {
        success: true,
        stdout,
        stderr
      }
    } catch (error) {
      console.error('Error creating virtual environment:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error creating venv'
      return {
        success: false,
        error: `Failed to create virtual environment: ${errorMsg}. Ensure Python 3.11+ is installed and in PATH.`
      }
    }
  }

  /**
   * Install ocrmypdf in the virtual environment
   */
  async installOcrmypdf(): Promise<CommandResult> {
    try {
      console.log('Installing ocrmypdf and PyPDF2...')

      // Upgrade pip first using the venv's Python
      console.log('Upgrading pip...')
      await execAsync(`"${this.pythonExecutable}" -m pip install --upgrade pip`, {
        maxBuffer: 10 * 1024 * 1024
      })

      // Install ocrmypdf and PyPDF2 using the venv's Python
      console.log('Installing ocrmypdf and PyPDF2 packages...')
      const { stdout, stderr } = await execAsync(
        `"${this.pythonExecutable}" -m pip install ocrmypdf PyPDF2`,
        { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer for long output
      )

      console.log('ocrmypdf and PyPDF2 installed successfully')

      // Generate requirements.txt after successful installation
      await this.generateRequirementsTxt()

      return {
        success: true,
        stdout,
        stderr
      }
    } catch (error) {
      console.error('Error installing ocrmypdf:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error installing ocrmypdf'
      }
    }
  }

  /**
   * Generate requirements.txt file with installed packages
   */
  async generateRequirementsTxt(): Promise<CommandResult> {
    try {
      console.log('Generating requirements.txt...')

      // Save requirements.txt in panopticon-python folder (parent of .venv)
      const pythonFolder = path.dirname(this.venvPath)
      const requirementsPath = path.join(pythonFolder, 'requirements.txt')

      // Use pip freeze to get installed packages
      const { stdout } = await execAsync(`"${this.pythonExecutable}" -m pip freeze`)

      // Write to requirements.txt file
      await writeFile(requirementsPath, stdout, 'utf-8')

      console.log('requirements.txt generated at:', requirementsPath)
      return {
        success: true,
        stdout: `Requirements file created at: ${requirementsPath}`
      }
    } catch (error) {
      console.error('Error generating requirements.txt:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error generating requirements.txt'
      }
    }
  }

  /**
   * Run ocrmypdf command on a file
   */
  async runOcrmypdf(
    inputPath: string,
    outputPath: string,
    options: string[] = []
  ): Promise<CommandResult> {
    try {
      console.log('Running ocrmypdf on:', inputPath)

      // Verify ocrmypdf executable exists
      try {
        await access(this.ocrmypdfExecutable, fs.constants.F_OK)
      } catch {
        throw new Error('ocrmypdf executable not found. Please run setupEnvironment() first.')
      }

      // Build command with options
      const optionsStr = options.join(' ')
      const command = `"${this.ocrmypdfExecutable}" ${optionsStr} "${inputPath}" "${outputPath}"`

      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large files
      })

      console.log('ocrmypdf completed successfully')
      return {
        success: true,
        stdout,
        stderr
      }
    } catch (error) {
      console.error('Error running ocrmypdf:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error running ocrmypdf'
      }
    }
  }

  /**
   * One-step setup: create venv and install ocrmypdf
   */
  async setupEnvironment(): Promise<CommandResult> {
    const logs: string[] = []

    try {
      this.sendProgress('=== Starting Python environment setup ===')
      logs.push('=== Starting Python environment setup ===')

      // Check current status
      this.sendProgress('Checking current environment status...')
      logs.push('Checking current environment status...')
      const status = await this.checkVenvStatus()

      // Create venv if it doesn't exist
      if (!status.exists) {
        this.sendProgress('Virtual environment not found, creating...')
        logs.push('Virtual environment not found, creating...')

        const createResult = await this.createVenv()
        if (!createResult.success) {
          const errorMsg = `Failed to create virtual environment: ${createResult.error}`
          this.sendProgress(`✗ ${errorMsg}`)
          return {
            success: false,
            stdout: logs.join('\n'),
            error: errorMsg
          }
        }

        this.sendProgress('✓ Virtual environment created successfully')
        logs.push('✓ Virtual environment created successfully')
      } else {
        this.sendProgress('✓ Virtual environment already exists')
        logs.push('✓ Virtual environment already exists')
      }

      // Install ocrmypdf if not installed
      if (!status.hasOcrmypdf) {
        this.sendProgress('ocrmypdf not found, installing packages...')
        logs.push('ocrmypdf not found, installing packages...')

        this.sendProgress('Upgrading pip...')
        logs.push('Upgrading pip...')

        const installResult = await this.installOcrmypdf()
        if (!installResult.success) {
          const errorMsg = `Failed to install ocrmypdf: ${installResult.error}`
          this.sendProgress(`✗ ${errorMsg}`)
          return {
            success: false,
            stdout: logs.join('\n'),
            error: errorMsg
          }
        }

        this.sendProgress('✓ pip upgraded successfully')
        logs.push('✓ pip upgraded successfully')

        this.sendProgress('Installing ocrmypdf package...')
        logs.push('Installing ocrmypdf package...')

        this.sendProgress('✓ ocrmypdf installed successfully')
        logs.push('✓ ocrmypdf installed successfully')
      } else {
        const msg = `✓ ocrmypdf already installed, version: ${status.ocrmypdfVersion}`
        this.sendProgress(msg)
        logs.push(msg)
      }

      // Generate requirements.txt
      this.sendProgress('Generating requirements.txt...')
      logs.push('Generating requirements.txt...')

      const reqResult = await this.generateRequirementsTxt()
      if (reqResult.success) {
        this.sendProgress('✓ requirements.txt generated successfully')
        logs.push('✓ requirements.txt generated successfully')
      } else {
        const warnMsg = `⚠ Failed to generate requirements.txt: ${reqResult.error}`
        this.sendProgress(warnMsg)
        logs.push(warnMsg)
      }

      this.sendProgress('=== Environment setup completed successfully ===')
      logs.push('=== Environment setup completed successfully ===')

      return {
        success: true,
        stdout: logs.join('\n')
      }
    } catch (error) {
      console.error('Error setting up environment:', error)
      const errorMsg = `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      this.sendProgress(errorMsg)
      logs.push(errorMsg)

      return {
        success: false,
        stdout: logs.join('\n'),
        error: error instanceof Error ? error.message : 'Unknown error setting up environment'
      }
    }
  }

  /**
   * Get the path to the Python executable in the venv
   */
  getPythonExecutable(): string {
    return this.pythonExecutable
  }

  /**
   * Get the path to the ocrmypdf executable in the venv
   */
  getOcrmypdfExecutable(): string {
    return this.ocrmypdfExecutable
  }

  /**
   * Create extract_pdf_text.py in the Python folder
   */
  private async createExtractScript(): Promise<void> {
    try {
      const pythonFolder = path.dirname(this.venvPath)
      const destScript = path.join(pythonFolder, 'extract_pdf_text.py')

      const scriptContent = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF Text Extraction Script
Extracts text from PDF files page by page using PyPDF2.
Returns JSON with page numbers and content.
"""

import sys
import json
import io
from pathlib import Path

# Force UTF-8 encoding for stdout to handle Unicode characters
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

try:
    from PyPDF2 import PdfReader
except ImportError:
    print(json.dumps({
        'success': False,
        'error': 'PyPDF2 not installed. Install with: pip install PyPDF2'
    }))
    sys.exit(1)


def extract_pdf_text(pdf_path: str) -> dict:
    """
    Extract text from PDF file page by page.
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        Dictionary with success status and page contents
    """
    try:
        # Check if file exists
        pdf_file = Path(pdf_path)
        if not pdf_file.exists():
            return {
                'success': False,
                'error': f'PDF file not found: {pdf_path}'
            }
        
        # Open and read the PDF
        reader = PdfReader(str(pdf_file))
        pages = []
        
        # Extract text from each page
        for page_num, page in enumerate(reader.pages, start=1):
            try:
                text = page.extract_text() or ''
                pages.append({
                    'pageNumber': page_num,
                    'content': text.strip()
                })
            except Exception as page_error:
                # If a specific page fails, include it with empty content
                pages.append({
                    'pageNumber': page_num,
                    'content': '',
                    'error': str(page_error)
                })
        
        return {
            'success': True,
            'pages': pages,
            'totalPages': len(reader.pages)
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to extract text: {str(e)}'
        }


def main():
    """Main entry point for the script."""
    if len(sys.argv) != 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: extract_pdf_text.py <pdf_file_path>'
        }))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    result = extract_pdf_text(pdf_path)
    
    # Output JSON result
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
    # Exit with appropriate code
    sys.exit(0 if result['success'] else 1)


if __name__ == '__main__':
    main()
`

      await writeFile(destScript, scriptContent, 'utf-8')
      pythonLogger.info(`Created extract_pdf_text.py at ${destScript}`)
    } catch (error) {
      pythonLogger.error('Failed to create extract_pdf_text.py:', error)
      // Don't throw - this is not critical to venv creation
    }
  }
}

// Export singleton instance
export const pythonEnvService = new PythonEnvService()
