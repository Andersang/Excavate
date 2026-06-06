# Panopticon

> A powerful desktop application for managing, searching, and organizing PDF documents with advanced OCR and bookmarking capabilities.

[![Latest Release](https://img.shields.io/github/v/release/Andersang/Panopticon)](https://github.com/Andersang/Panopticon/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Andersang/Panopticon/total)](https://github.com/Andersang/Panopticon/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

## 📥 Download

**[Download Latest Version](https://github.com/Andersang/Panopticon/releases/latest)**

### System Requirements
- **OS**: Windows 10/11 (64-bit)
- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 500MB for application

## ✨ Features

### 📚 Library Management
- Browse and organize PDF files from multiple directories
- Automatic file detection and indexing
- Custom tagging system for better organization
- File metadata tracking (size, dates, tags)

### 📄 PDF Viewing
- High-performance PDF rendering with Pdfium engine
- Smooth page navigation and zoom controls
- Thumbnail sidebar for quick navigation
- Full-text search within documents
- Text selection and copying

### 🔍 Advanced Search
- Full-text search across all indexed documents
- Tag-based filtering
- Search term highlighting
- Search history and saved searches
- Quick result preview with snippets

### 📑 Bookmarks & Notes
- Bookmark important pages with custom notes
- Organize bookmarks with tags
- Quick navigation to bookmarked pages
- Export and import bookmarks

### 🤖 Text Extraction & OCR
- **Local OCR**: Built-in Tesseract OCR for offline processing
- Batch processing for multiple documents
- Automatic Python environment setup

### ⚙️ Customization
- Dark mode support
- Configurable directory watching
- Flexible tagging system

## 🚀 Quick Start

1. **Download** the latest installer from [Releases](https://github.com/Andersang/Panopticon/releases)
2. **Run** the installer (`Panopticon-Setup-X.X.X.exe`)
3. **Launch** Panopticon from Start Menu or Desktop
4. **Add Directory** - Click the "+" button to add folders containing PDFs
5. **Start Browsing** - Your PDFs will be automatically indexed

## 📖 Documentation

### Adding Directories
1. Click the **"+"** button in the Library view
2. Select a folder containing PDF files
3. Wait for automatic indexing to complete
4. Files will appear in the file list

### Using OCR
**Local OCR (Offline):**
- Select files in Library view
- Click "Process Selected Files"
- Choose "Local OCR (Tesseract)"
- Wait for processing to complete

### Creating Bookmarks
1. Open any PDF document
2. Navigate to the page you want to bookmark
3. Click the bookmark icon (⭐) in the toolbar
4. Add a title, notes, and tags
5. Save the bookmark

### Searching Documents
**Simple Search:**
- Type your query in the Search view
- Results appear with highlighted snippets
- Click any result to open at the matching page

**Advanced Filtering:**
- Use tags to filter results
- Filter by specific directories
- Save frequently used searches

## 🔧 Settings

### Directory Management
- Add/remove indexed directories
- View indexing status
- Re-index directories when needed

### Python Environment
- Automatic detection of system Python
- Virtual environment creation if needed
- Package installation for OCR dependencies

## 📝 Release Notes

See [Release Notes](./release-notes/) for detailed changelog of each version.

## 🐛 Known Issues

- First-time Python environment setup may take a few minutes
- Large PDFs (>100MB) may have slower initial load times
- OCR processing is CPU-intensive

## 💬 Support

For issues, questions, or feature requests:
- Open an issue in this repository
- Check existing issues for solutions

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

Built with:
- [Electron](https://www.electronjs.org/) - Desktop application framework
- [Vue 3](https://vuejs.org/) - Progressive JavaScript framework
- [EmbedPDF](https://github.com/nitro-pdf/embed-pdf) - PDF rendering engine
- [Tesseract.js](https://tesseract.projectnaptha.com/) - OCR engine
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

---

**Note:** This is a releases-only repository. The source code is maintained in a private repository.
