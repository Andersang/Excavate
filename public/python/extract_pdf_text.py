#!/usr/bin/env python3
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
