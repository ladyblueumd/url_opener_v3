# Work Order URL Browser

An Electron-based application for batch processing and browsing Field Nation work order URLs. This application allows you to:

1. Load URLs from a CSV file or paste them manually
2. Open batches of URLs in an embedded browser
3. Create separate browser windows for each batch
4. Track URL access history (time, date, batch ID)
5. Save downloaded content from work orders

## Features

- **Embedded browser** - Browse work order pages without leaving the application
- **Batch processing** - Process large numbers of URLs in manageable batches
- **Access history** - Keep track of which URLs have been opened and when
- **Persistent storage** - Data is saved between application sessions
- **Download support** - Save PDFs and other content from work order pages

## Installation

### Prerequisites

- Node.js 16 or later
- npm 7 or later

### Setup

1. Clone or download this repository
2. Run the installation script:

```bash
chmod +x ../install.sh
../install.sh
```

Or manually install:

```bash
cd url_opener
npm install
npm run dev
```

## Usage

1. **Load URLs**:
   - Upload a CSV file with work order URLs (should have a URL column)
   - Or paste URLs directly into the text area (one URL per line)

2. **Configure Batch Settings**:
   - Batch Size: Number of URLs in each batch
   - Batch Delay: Time to wait between batches
   - Tab Delay: Time to wait between opening tabs

3. **Process URLs**:
   - Click on a batch number to open that batch in a new browser window
   - Navigate through the URLs using the embedded browser
   - Download or copy content as needed

4. **View History**:
   - See which URLs have been accessed
   - Filter and search through URL history
   - Open historical URLs in external browser if needed

## Development

### Running in Development Mode

```bash
npm run dev
```

### Building for Production

```bash
npm run build-electron
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Credits

- React.js - Frontend framework
- Electron - Cross-platform desktop application framework
- Electron Store - Persistent data storage 