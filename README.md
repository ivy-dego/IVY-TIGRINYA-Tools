
# Ivy Tools

## Tigrinya Image and PDF to Text Converter

Version 1.1

Ivy Tools is a free browser-based OCR application
for converting printed Tigrinya documents into text.

## Features

- Tigrinya OCR
- Optional Tigrinya and English recognition
- JPG and PNG support
- PDF document support
- Multiple page uploads
- Drag and drop
- Page sorting
- Individual page removal
- Rotate images left or right by 90 degrees
- Adjust image contrast
- Adjust image brightness
- Interactive image cropping
- Reset original image
- OCR progress indicator
- Editable extracted text
- Copy to clipboard
- Download UTF-8 text files
- Native text sharing where supported
- Responsive mobile-friendly design

## Privacy

Files are processed locally in your browser.

The application downloads external JavaScript
libraries and OCR language models.

Selected documents are not intentionally uploaded
to a remote OCR server.

Sharing text through another application may
send that text to the selected service.

## Technologies

- HTML5
- CSS3
- JavaScript
- HTML Canvas
- Tesseract.js
- PDF.js
- Cropper.js
- Web Share API
- GitHub Pages

## Run Locally

Start a development server:

    python3 -m http.server 8000 --bind 127.0.0.1

Open:

    http://localhost:8000

## Limitations

- Internet access is needed initially.
- OCR accuracy depends on document quality.
- Always review the extracted text.
- Maximum 50 pages per session.
- Very large images may be resized.
- Large documents may consume considerable memory.
- Password-protected PDFs are not supported.
- Native sharing depends on browser support.
- PDFs are processed as page images.

## Version History

### Version 1.1

- Added PDF input
- Added left and right rotation
- Added contrast and brightness adjustments
- Added image cropping
- Added image reset
- Added native text sharing

### Version 1.0

- Initial release
- Tigrinya OCR
- JPG and PNG upload
- Multiple page sorting
- Copy and download extracted text
