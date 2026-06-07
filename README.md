# Excavate

Excavate is a desktop application for managing and searching through PDF documents with advanced text extraction and bookmarking capabilities.

## Vibe coding experiment notice

Excavate is also an experiment in vibe-coding, to see how far I can take building a complex application with a focus on user experience, without any manual writing of code. The entire application, including the README, is generated through prompts and interactions with AI tools. This approach allows for rapid iteration and a unique development process, but may also lead to some quirks or inconsistencies as the AI learns and adapts, as well as high api/token costs.

## Features

- Intelligent search across thousands of PDF pages
- Text extraction using OCR on your device
- Bookmarking capabilities for quick access to important pages
- Real-time file system monitoring
- Local storage: all data stored in ```documents/Excavate``` (settings, saved searches) and within your library directories (processed indexes)

## Important Notice

Excavate creates and maintains essential data in two locations. First, a folder named "Excavate" appears in your documents directory, containing application settings, and saved searches. Second, data folders and configuration files are placed within each library directory you add, preserving your tags and preferences. Removing these folders will result in permanent loss of your stored information and settings.

## Prerequisites

### Platform Support

- Windows only (I do not have a Mac to test this on)

### Document OCR

PDFs are processed locally using Tesseract.js, a pure JavaScript OCR library with no external dependencies. This means all text extraction happens on your device, ensuring privacy and offline functionality.

## How to use

This section quickly explains how to get Excavate running, add and index your PDF library, search, and use the main features.

### 1. Install (release user)

- Download and install the prerequisites.
- Download the latest installer from the Releases page: [Excavate](https://github.com/Andersang/Excavate/releases).
- Run the installer and follow on-screen prompts. Excavate will create a user directory at `%USERPROFILE%\Documents\Excavate`.

### 2. Settings & Offline Mode

- Open Settings to configure offline mode, directory preferences and exclude patterns.

### 3. Open the app & add library directories

1. Launch Excavate from the Start Menu or Desktop shortcut.
2. Click the + (Add Directory) button in the left sidebar to add folders to your library.
3. Choose file types to index (PDF is the default). The app will scan your selected folders and build a local search index.

Hints:

- First scan may take a while depending on the number and size of files. You can continue using the app while the initial indexing runs.
- If a folder has many large PDFs, consider allowing the app a few minutes to finish before performing heavy searches.

### 4. Searching

1. Use the search field at the top. Excavate searches across titles, text extracted via OCR, and saved tags.
2. Search suggestions and saved queries may appear as you type.
3. Use quotes to force exact matches and common boolean operators (AND, OR) for narrower searches.

### 5. Managing bookmarks

1. While viewing a PDF, click the bookmark icon to store the current page and add notes or tags.
2. Bookmarks are saved per-file and are visible in the Bookmarks view.
3. Use tags on bookmarks to organise them and speed up future searches.

### 6. Document processing & OCR

- Excavate uses OCR to extract searchable text from scanned PDFs. After adding a file, click `Process` to run OCR and text extraction.

### 7. Updates

- Excavate checks GitHub releases for updates automatically (every 24 hours) and notifies you on the About page if a new version exists.
- You can manually check for updates from the About page or use Settings → Check for updates.

If you need help or want to report a bug, open an issue on the releases repo or contact me at [andersang.wl@gmail.com](mailto:andersang.wl@gmail.com).

## Updates

New releases can be found on Github at [Excavate/Release](https://github.com/Andersang/Excavate/releases).

## Support Development

If you find Excavate useful, please consider [supporting me on Ko-fi](https://ko-fi.com/andersang).

## Licence Overview

### Free for Everyone

Excavate is free for all purposes, including personal, commercial, and non-profit use.

### No Account Required

Downloading and using Excavate requires no account, and we do not collect your personal information.

### Your Data Remains Local

Your processed search indices and application data are saved locally on your device. Your search activity remains entirely private on your machine, as we don't run any servers for Excavate itself.

#### Document OCR

All processing occurs entirely on your device.

### You Own Your Content

You retain full ownership of all content you process in Excavate. We claim no rights to it.

We own and reserve rights to our own content, including the application's text, images, and code, which are protected by copyright and other laws.

### Terms of Use

By using Excavate, you agree to our [Terms of Service](#terms-of-service). Please read these terms carefully, as they outline our relationship, including provisions for licensing, security, privacy, liability, and dispute resolution.

## Terms of Service

**Last updated: 06-06-2026**

## Agreement

By using Excavate, you agree to these Terms of Service. If you do not agree, please do not use the software.

## License

We grant you a free, non-transferable, non-exclusive licence to use Excavate for any purpose, including personal, commercial, and non-profit use.

You may not:

- Sell, rent, lease, or distribute/re-distribute Excavate
- Reverse engineer or decompile the software
- Remove copyright notices or branding
- Use Excavate for unlawful purposes

## Ownership

**Your Content**: You retain full ownership of all content you process through Excavate. We claim no rights to your files, notes, or data.

**Our Software**: We own all rights to Excavate's code, design, and branding. The software is licensed to you, not sold.

## Privacy and Data

We do not collect, store, or transmit your personal information. Your search indices and application data remain on your device. We operate no servers for Excavate.

## Disclaimer

Excavate is provided "as is" without warranties of any kind. We do not guarantee that the software will be error-free, uninterrupted, or suitable for your specific needs.

We are not responsible for:

- Loss of data or content
- Accuracy or completeness of search results
- Issues arising from third party services
- Compatibility with your system or other software

## Limitation of Liability

To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of Excavate. Our total liability shall not exceed the amount you paid for Excavate (which is zero, as the software is free).

This limitation does not exclude liability for death or personal injury caused by our negligence, or for fraud.

## User Responsibilities

You agree to:

- Use Excavate only for lawful purposes
- Comply with all applicable laws
- Not use the software to harm others or their property
- Not upload or process content that infringes third party rights

You are solely responsible for ensuring your use of Excavate complies with relevant regulations.

## Termination

You may stop using Excavate at any time by uninstalling the software. We reserve the right to discontinue development or support of Excavate without notice.

## Changes to Terms

We may update these Terms of Service from time to time. Continued use of Excavate after changes constitutes acceptance of the revised terms.

## Governing Law

These Terms are governed by the laws of Singapore. Any disputes shall be resolved in the courts of Singapore.

## Contact

For questions about these Terms of Service, please contact: [andersang.wl@gmail.com](mailto:andersang.wl@gmail.com)

---
