// ========================================
// Ivy Tools - Version 1.0
// Tigrinya Image to Text Converter
// ========================================


// 1. Get HTML elements

const imageInput = document.getElementById("imageInput");
const pageList = document.getElementById("pageList");
const convertBtn = document.getElementById("convertBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const output = document.getElementById("output");
const progressBar = document.getElementById("progressBar");
const statusText = document.getElementById("status");
const dropZone = document.getElementById("dropZone");


// 2. Store uploaded images

let pages = [];
let processing = false;


// 3. Add images to the page list

function addFiles(files) {

    if (processing) return;

    let added = 0;

    for (const file of files) {

        const validType =
            file.type === "image/jpeg" ||
            file.type === "image/png";

        if (!validType) {
            continue;
        }

        pages.push({
            file: file,
            url: URL.createObjectURL(file)
        });

        added++;
    }

    if (!added) {
        statusText.textContent =
            "Please choose valid JPG or PNG images.";
        return;
    }

    progressBar.value = 0;

    statusText.textContent =
        `${pages.length} page(s) ready. Previous text is unchanged.`;

    renderPages();
}


// 4. Handle file selection

imageInput.addEventListener("change", function () {

    addFiles(imageInput.files);

    // Allow the same file to be selected again
    imageInput.value = "";
});


// 5. Display uploaded images

function renderPages() {

    pageList.replaceChildren();

    pages.forEach((page, index) => {

        const row = document.createElement("div");
        row.className = "page-item";

        const image = document.createElement("img");
        image.src = page.url;
        image.alt = `Page ${index + 1}`;

        const name = document.createElement("span");
        name.className = "page-name";

        name.textContent =
            `${index + 1}. ${page.file.name}`;

        const controls = document.createElement("div");
        controls.className = "page-controls";


        // Move up button

        const upBtn = document.createElement("button");

        upBtn.textContent = "↑";
        upBtn.title = "Move page up";

        upBtn.setAttribute(
            "aria-label",
            `Move page ${index + 1} up`
        );

        upBtn.disabled = processing || index === 0;

        upBtn.addEventListener("click", function () {
            movePage(index, -1);
        });


        // Move down button

        const downBtn = document.createElement("button");

        downBtn.textContent = "↓";
        downBtn.title = "Move page down";

        downBtn.setAttribute(
            "aria-label",
            `Move page ${index + 1} down`
        );

        downBtn.disabled =
            processing || index === pages.length - 1;

        downBtn.addEventListener("click", function () {
            movePage(index, 1);
        });


        // Remove button

        const removeBtn = document.createElement("button");

        removeBtn.textContent = "✕";
        removeBtn.className = "remove";
        removeBtn.title = "Remove page";
        removeBtn.disabled = processing;

        removeBtn.setAttribute(
            "aria-label",
            `Remove page ${index + 1}`
        );

        removeBtn.addEventListener("click", function () {
            removePage(index);
        });


        controls.append(upBtn, downBtn, removeBtn);

        row.append(image, name, controls);

        pageList.appendChild(row);
    });

    convertBtn.disabled = processing || pages.length === 0;
    clearBtn.disabled = processing ||
        (pages.length === 0 && !output.value);
}


// 6. Move pages up or down

function movePage(index, direction) {

    if (processing) return;

    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= pages.length) {
        return;
    }

    // Swap the position of two pages

    [pages[index], pages[newIndex]] =
        [pages[newIndex], pages[index]];

    statusText.textContent =
        "Page order changed. Convert again to update text.";

    progressBar.value = 0;

    renderPages();
}


// 7. Remove individual pages

function removePage(index) {

    if (processing) return;

    URL.revokeObjectURL(pages[index].url);

    pages.splice(index, 1);

    progressBar.value = 0;

    statusText.textContent =
        `${pages.length} page(s) remaining.`;

    renderPages();
}


// 8. Clear all images and text

clearBtn.addEventListener("click", function () {

    if (processing) return;

    if (output.value.trim() &&
        !window.confirm("Clear all images and extracted text?")) {
        return;
    }

    pages.forEach(page => {
        URL.revokeObjectURL(page.url);
    });

    pages = [];

    output.value = "";
    progressBar.value = 0;

    statusText.textContent = "Waiting for images...";

    renderPages();
});


// 9. Drag and drop functionality

dropZone.addEventListener("dragover", function (event) {

    event.preventDefault();

    if (!processing) {
        dropZone.classList.add("dragover");
    }
});

dropZone.addEventListener("dragleave", function () {

    dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", function (event) {

    event.preventDefault();

    dropZone.classList.remove("dragover");

    if (!processing) {
        addFiles(event.dataTransfer.files);
    }
});


// 10. Convert the images into Tigrinya text

convertBtn.addEventListener("click", async function () {

    if (pages.length === 0 || processing) return;

    if (typeof Tesseract === "undefined") {

        statusText.textContent =
            "OCR library could not load. Check your internet connection.";

        return;
    }

    if (output.value.trim() &&
        !window.confirm("Replace the existing extracted text?")) {
        return;
    }

    processing = true;

    imageInput.disabled = true;
    copyBtn.disabled = true;
    downloadBtn.disabled = true;
    output.readOnly = true;

    progressBar.value = 0;

    let worker = null;
    let currentPage = 0;

    const results = [];
    const totalPages = pages.length;

    output.value = "";

    renderPages();

    try {

        statusText.textContent =
            "Loading Tigrinya OCR language model...";


        // Create the Tigrinya OCR worker

        worker = await Tesseract.createWorker(
            "tir",
            1,
            {
                logger: function (message) {

                    if (message.status === "recognizing text") {

                        const fraction =
                            Math.max(0, Math.min(1, message.progress || 0));

                        const progress =
                            ((currentPage + fraction)
                            / totalPages) * 100;

                        progressBar.value =
                            Math.round(progress);

                        statusText.textContent =
                            `Processing page ${currentPage + 1} ` +
                            `of ${totalPages} — ` +
                            `${Math.round(progress)}%`;

                    } else {

                        statusText.textContent =
                            message.status || "Loading OCR...";

                    }
                }
            }
        );


        // Process each image in the selected order

        for (let i = 0; i < totalPages; i++) {

            currentPage = i;

            statusText.textContent =
                `Processing page ${i + 1} of ${totalPages}...`;

            const result = await worker.recognize(
                pages[i].file
            );

            results.push(result.data.text.trim());


            // Combine the extracted text

            output.value = results.join("\n\n");

            progressBar.value =
                Math.round(((i + 1) / totalPages) * 100);
        }


        // Conversion finished

        progressBar.value = 100;

        statusText.textContent =
            `Completed! ${totalPages} page(s) converted. ` +
            "Please review the text for errors.";

    } catch (error) {

        console.error(error);

        statusText.textContent =
            `Conversion failed after ${results.length} page(s). ` +
            "Any completed text is preserved. " +
            "Check your internet connection and images.";

    } finally {

        if (worker) {

            try {
                await worker.terminate();
            } catch (error) {
                console.error(error);
            }
        }

        processing = false;

        imageInput.disabled = false;
        copyBtn.disabled = false;
        downloadBtn.disabled = false;
        output.readOnly = false;

        renderPages();
    }
});


// 11. Copy extracted text

copyBtn.addEventListener("click", async function () {

    if (!output.value.trim()) {

        statusText.textContent = "There is no text to copy.";

        return;
    }

    try {

        await navigator.clipboard.writeText(output.value);

        statusText.textContent = "Text copied successfully!";

    } catch (error) {

        output.focus();
        output.select();

        statusText.textContent =
            "Text selected. Press Ctrl+C or Cmd+C to copy.";
    }
});


// 12. Download extracted text

downloadBtn.addEventListener("click", function () {

    if (!output.value.trim()) {

        statusText.textContent =
            "There is no text to download.";

        return;
    }

    const blob = new Blob(
        [output.value],
        { type: "text/plain;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "ivy-tools-tigrinya.txt";

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
});


// 13. Update buttons when text is edited

output.addEventListener("input", function () {

    clearBtn.disabled = processing ||
        (pages.length === 0 && !output.value);
});


// 14. Initialize the website

renderPages();