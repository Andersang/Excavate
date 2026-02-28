import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import { pythonEnvService } from './pythonEnvService'

const execAsync = promisify(exec)

export interface SystemDependency {
  name: string
  version?: string
  isInstalled: boolean
  isValidVersion?: boolean
  requiredVersion?: string
  architecture?: string
  error?: string
}

export interface SystemCheckResult {
  python: SystemDependency
  tesseract: SystemDependency
  ghostscript: SystemDependency
  pypdf2: SystemDependency
  allRequirementsMet: boolean
}

class SystemCheckService {
  async checkPython(): Promise<SystemDependency> {
    try {
      // Check Python version
      console.log('Checking Python installation...')
      const { stdout } = await execAsync('python --version 2>&1')
      console.log('Python version output:', stdout)
      const versionMatch = stdout.match(/Python (\d+\.\d+\.\d+)/)

      if (versionMatch) {
        const version = versionMatch[1]
        const [major, minor] = version.split('.').map(Number)
        const isValidVersion = major >= 3 && (major > 3 || minor >= 11)

        // Check if it's 64-bit
        const { stdout: archOutput } = await execAsync(
          'python -c "import platform; print(platform.architecture()[0])" 2>&1'
        )
        console.log('Python architecture output:', archOutput)
        const is64bit = archOutput.trim() === '64bit'

        return {
          name: 'Python',
          version,
          isInstalled: true,
          isValidVersion: isValidVersion && is64bit,
          requiredVersion: '3.11+',
          architecture: is64bit ? '64-bit' : '32-bit',
          error: !isValidVersion
            ? 'Version 3.11+ required'
            : !is64bit
              ? '64-bit version required'
              : undefined
        }
      } else {
        console.log('Could not parse Python version from output')
        return {
          name: 'Python',
          isInstalled: false,
          requiredVersion: '3.11+',
          error: 'Python not found or invalid version output'
        }
      }
    } catch (error) {
      console.log('Python not found in PATH:', error)
      return {
        name: 'Python',
        isInstalled: false,
        requiredVersion: '3.11+',
        error: 'Python not found in PATH'
      }
    }
  }

  async checkTesseract(): Promise<SystemDependency> {
    // First try the standard PATH
    try {
      const { stdout } = await execAsync('tesseract --version 2>&1')

      // Try to extract version, but don't fail if we can't parse it
      const versionMatch = stdout.match(/tesseract v(\d+\.\d+\.\d+(?:\.\d+)?)/)
      const version = versionMatch ? versionMatch[1] : 'Unknown version'

      // Check if it's 64-bit (on Windows, check program files location)
      let is64bit = true
      try {
        const { stdout: whereOutput } = await execAsync('where tesseract 2>&1')
        is64bit =
          whereOutput.includes('Program Files') && !whereOutput.includes('Program Files (x86)')
      } catch {
        // If 'where' command fails, assume it's installed correctly
      }

      return {
        name: 'Tesseract',
        version,
        isInstalled: true,
        isValidVersion: is64bit,
        architecture: is64bit ? '64-bit' : '32-bit',
        error: !is64bit ? '64-bit version recommended' : undefined
      }
    } catch (error) {
      // If not found in PATH, try common installation directory
      console.log('Tesseract not found in PATH, checking common installation directories...')
      try {
        const { stdout } = await execAsync('tesseract --version', {
          env: { ...process.env, PATH: process.env.PATH + ';C:\\Program Files\\Tesseract-OCR\\' }
        })
        console.log('Tesseract found in common directory:', stdout)

        // Try to extract version, but don't fail if we can't parse it
        const versionMatch = stdout.match(/tesseract v(\d+\.\d+\.\d+(?:\.\d+)?)/)
        const version = versionMatch ? versionMatch[1] : 'Unknown version'

        return {
          name: 'Tesseract',
          version,
          isInstalled: true,
          isValidVersion: true, // Assume 64-bit if found in Program Files
          architecture: '64-bit',
          error: 'Found but not in PATH - add C:\\Program Files\\Tesseract-OCR\\ to system PATH'
        }
      } catch (secondError) {
        console.log('Tesseract not found at C:\\Program Files\\Tesseract-OCR\\:', secondError)
      }

      return {
        name: 'Tesseract',
        isInstalled: false,
        error: 'Tesseract not found in PATH or common installation directories'
      }
    }
  }

  async checkGhostscript(): Promise<SystemDependency> {
    console.log('Checking Ghostscript installation...')

    // First, try to find Ghostscript in PATH
    const pathResult = await this.tryGhostscriptInPath()
    if (pathResult.isInstalled) {
      return pathResult
    }

    // If not found in PATH, check common Program Files locations
    console.log('Ghostscript not found in PATH, checking Program Files locations...')
    const programFilesResult = await this.tryGhostscriptInProgramFiles()
    if (programFilesResult.isInstalled) {
      return programFilesResult
    }

    // If still not found, return not installed
    return {
      name: 'Ghostscript',
      isInstalled: false,
      error: 'Ghostscript not found in PATH or common installation directories'
    }
  }

  private async tryGhostscriptInPath(): Promise<SystemDependency> {
    try {
      // Try both 'gs' and 'gswin64c' commands
      let stdout: string
      let is64bit = false

      try {
        console.log('Trying gswin64c command...')
        const result = await execAsync('gswin64c --version 2>&1')
        stdout = result.stdout
        console.log('Ghostscript gswin64c output:', stdout)
        is64bit = true
      } catch {
        try {
          console.log('gswin64c not found, trying gs command...')
          const result = await execAsync('gs --version 2>&1')
          stdout = result.stdout
          console.log('Ghostscript gs output:', stdout)
          is64bit = stdout.includes('64') || process.arch === 'x64'
        } catch {
          console.log('gswin32c fallback...')
          const result = await execAsync('gswin32c --version 2>&1')
          stdout = result.stdout
          console.log('Ghostscript gswin32c output:', stdout)
          is64bit = false
        }
      }

      const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/) || stdout.match(/(\d+\.\d+)/)
      console.log('Ghostscript version match:', versionMatch)

      if (versionMatch) {
        const version = versionMatch[1]

        return {
          name: 'Ghostscript',
          version,
          isInstalled: true,
          isValidVersion: is64bit,
          architecture: is64bit ? '64-bit' : '32-bit',
          error: !is64bit ? '64-bit version recommended' : undefined
        }
      } else {
        throw new Error('Could not parse version from output')
      }
    } catch (error) {
      console.log('Ghostscript not found in PATH:', error)
      return {
        name: 'Ghostscript',
        isInstalled: false,
        error: 'Not found in PATH'
      }
    }
  }

  private async tryGhostscriptInProgramFiles(): Promise<SystemDependency> {
    // Common Ghostscript installation paths on Windows
    const commonPaths = [
      'C:\\Program Files\\gs\\gs*\\bin',
      'C:\\Program Files (x86)\\gs\\gs*\\bin',
      'C:\\Program Files\\GPL Ghostscript\\gs*\\bin',
      'C:\\Program Files (x86)\\GPL Ghostscript\\gs*\\bin'
    ]

    for (const basePath of commonPaths) {
      try {
        console.log(`Checking path pattern: ${basePath}`)

        // Handle wildcard pattern by checking if parent directory exists
        const parentDir = basePath.replace('\\gs*\\bin', '')
        if (!fs.existsSync(parentDir)) {
          continue
        }

        // Find gs* directories
        const gsDirectories = fs
          .readdirSync(parentDir)
          .filter(
            (dir) => dir.startsWith('gs') && fs.statSync(path.join(parentDir, dir)).isDirectory()
          )
          .sort()
          .reverse() // Try newest versions first

        for (const gsDir of gsDirectories) {
          const binPath = path.join(parentDir, gsDir, 'bin')
          if (!fs.existsSync(binPath)) {
            continue
          }

          console.log(`Found Ghostscript directory: ${binPath}`)

          // Try different executable names
          const executables = ['gswin64c.exe', 'gs.exe', 'gswin32c.exe']

          for (const exe of executables) {
            const exePath = path.join(binPath, exe)
            if (fs.existsSync(exePath)) {
              console.log(`Found Ghostscript executable: ${exePath}`)

              try {
                // Test the executable
                const { stdout } = await execAsync(`"${exePath}" --version 2>&1`)
                console.log('Ghostscript Program Files output:', stdout)

                const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/) || stdout.match(/(\d+\.\d+)/)
                const version = versionMatch ? versionMatch[1] : 'Unknown version'
                const is64bit =
                  exe.includes('64') ||
                  (basePath.includes('Program Files') && !basePath.includes('(x86)'))

                return {
                  name: 'Ghostscript',
                  version,
                  isInstalled: true,
                  isValidVersion: is64bit,
                  architecture: is64bit ? '64-bit' : '32-bit',
                  error: `Found at ${exePath} but not in PATH - consider adding ${binPath} to system PATH`
                }
              } catch (testError) {
                console.log(`Failed to test ${exePath}:`, testError)
                continue
              }
            }
          }
        }
      } catch (dirError) {
        console.log(`Error checking ${basePath}:`, dirError)
        continue
      }
    }

    return {
      name: 'Ghostscript',
      isInstalled: false,
      error: 'Not found in common Program Files locations'
    }
  }

  async getGhostscriptExecutablePath(): Promise<string | null> {
    console.log('Getting Ghostscript executable path...')

    // First, try commands in PATH
    const pathCommands = ['gswin64c', 'gs', 'gswin32c']
    for (const cmd of pathCommands) {
      try {
        await execAsync(`${cmd} --version 2>&1`)
        console.log(`Found Ghostscript in PATH: ${cmd}`)
        return cmd
      } catch {
        continue
      }
    }

    // If not found in PATH, check Program Files
    const commonPaths = [
      'C:\\Program Files\\gs\\gs*\\bin',
      'C:\\Program Files (x86)\\gs\\gs*\\bin',
      'C:\\Program Files\\GPL Ghostscript\\gs*\\bin',
      'C:\\Program Files (x86)\\GPL Ghostscript\\gs*\\bin'
    ]

    for (const basePath of commonPaths) {
      try {
        const parentDir = basePath.replace('\\gs*\\bin', '')
        if (!fs.existsSync(parentDir)) {
          continue
        }

        const gsDirectories = fs
          .readdirSync(parentDir)
          .filter(
            (dir) => dir.startsWith('gs') && fs.statSync(path.join(parentDir, dir)).isDirectory()
          )
          .sort()
          .reverse()

        for (const gsDir of gsDirectories) {
          const binPath = path.join(parentDir, gsDir, 'bin')
          if (!fs.existsSync(binPath)) {
            continue
          }

          const executables = ['gswin64c.exe', 'gs.exe', 'gswin32c.exe']
          for (const exe of executables) {
            const exePath = path.join(binPath, exe)
            if (fs.existsSync(exePath)) {
              try {
                await execAsync(`"${exePath}" --version 2>&1`)
                console.log(`Found Ghostscript executable: ${exePath}`)
                return exePath
              } catch {
                continue
              }
            }
          }
        }
      } catch {
        continue
      }
    }

    console.log('Ghostscript executable not found')
    return null
  }

  async checkPyPDF2(): Promise<SystemDependency> {
    try {
      // Check if venv exists first
      const venvStatus = await pythonEnvService.checkVenvStatus()
      
      if (!venvStatus.exists) {
        return {
          name: 'PyPDF2',
          isInstalled: false,
          requiredVersion: 'any',
          error: 'Python virtual environment not found. Please set up Python environment first.'
        }
      }

      // Get Python executable from venv
      const pythonPath = pythonEnvService.getPythonExecutable()
      
      // Use venv Python to check if PyPDF2 is installed
      const { stdout } = await execAsync(
        `"${pythonPath}" -c "import PyPDF2; print(PyPDF2.__version__)" 2>&1`
      )

      const version = stdout.trim()

      return {
        name: 'PyPDF2',
        version,
        isInstalled: true,
        isValidVersion: true,
        requiredVersion: 'any'
      }
    } catch (error) {
      return {
        name: 'PyPDF2',
        isInstalled: false,
        requiredVersion: 'any',
        error: 'PyPDF2 not installed in Python environment. Install with: pip install PyPDF2'
      }
    }
  }

  async checkAllDependencies(): Promise<SystemCheckResult> {
    const [python, tesseract, ghostscript, pypdf2] = await Promise.all([
      this.checkPython(),
      this.checkTesseract(),
      this.checkGhostscript(),
      this.checkPyPDF2()
    ])

    const allRequirementsMet =
      python.isInstalled &&
      (python.isValidVersion ?? false) &&
      tesseract.isInstalled &&
      (tesseract.isValidVersion ?? true) &&
      ghostscript.isInstalled &&
      (ghostscript.isValidVersion ?? true) &&
      pypdf2.isInstalled

    return {
      python,
      tesseract,
      ghostscript,
      pypdf2,
      allRequirementsMet
    }
  }
}

export const systemCheckService = new SystemCheckService()
