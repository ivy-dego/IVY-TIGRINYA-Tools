
// ============================================
// Ivy Tools - Version 1.1
// Tigrinya Image and PDF OCR
// ============================================


// 1. HTML ELEMENTS

const $ = id => document.getElementById(id);

const fileInput = $("fileInput");
const pageList = $("pageList");
const dropZone = $("dropZone");

const editorPanel = $("editorPanel");
const previewCanvas = $("previewCanvas");

const contrast = $("contrast");
const brightness = $("brightness");

const output = $("output");
const statusText = $("status");
const progressBar = $("progressBar");

const cropDialog = $("cropDialog");
const cropImage = $("cropImage");


// 2. APPLICATION STATE

let pages = [];
let selectedIndex = -1;

let busy = false;
let cropper = null;
let cropPage = null;

const MAX_PIXELS = 12000000;
const MAX_PAGES = 50;


// 3. PDF WORKER CONFIGURATION

if (window.pdfjsLib) {

    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

}


// 4. CANVAS HELPERS

function createCanvas(width, height) {

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    return canvas;
}


function copyCanvas(source) {

    const canvas = createCanvas(
        source.width,
        source.height
    );

    canvas.getContext("2d").drawImage(source, 0, 0);

    return canvas;
}


function canvasToBlob(canvas) {

    return new Promise((resolve, reject) => {

        canvas.toBlob(blob => {

            if (blob) {
                resolve(blob);
            } else {
                reject(new Error("Could not create image."));
            }

        }, "image/png");

    });
}


// 5. CREATE A PAGE OBJECT

function createPage(name, canvas) {

    return {

        name: name,

        original: canvas,
        base: canvas,

        rotation: 0,
        contrast: 100,
        brightness: 100

    };
}


// 6. LOAD JPG OR PNG IMAGE

async function loadImage(file) {

    const url = URL.createObjectURL(file);

    try {

        const image = new Image();

        image.src = url;

        await image.decode();

        const scale = Math.min(
            1,
            Math.sqrt(
                MAX_PIXELS /
                (image.naturalWidth * image.naturalHeight)
            )
        );

        const canvas = createCanvas(
            Math.max(1, Math.round(image.naturalWidth * scale)),
            Math.max(1, Math.round(image.naturalHeight * scale))
        );

        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "white";

        ctx.fillRect(
            0, 0, canvas.width, canvas.height
        );

        ctx.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
        );

        return createPage(file.name, canvas);

    } finally {

        URL.revokeObjectURL(url);

    }
}


// 7. LOAD PDF DOCUMENT

async function loadPDF(file) {

    if (!window.pdfjsLib) {

        throw new Error("PDF library could not load.");

    }

    const data = await file.arrayBuffer();

    const task = pdfjsLib.getDocument({

        data: data,

        // Disable dynamic JavaScript evaluation
        isEvalSupported: false

    });

    try {

        const pdf = await task.promise;

        if (pdf.numPages + pages.length > MAX_PAGES) {

            throw new Error(
                `Maximum ${MAX_PAGES} pages per session.`
            );

        }

        for (let n = 1; n <= pdf.numPages; n++) {

            statusText.textContent =
                `Reading PDF page ${n} of ${pdf.numPages}...`;

            const pdfPage = await pdf.getPage(n);

            try {

                const naturalViewport =
                    pdfPage.getViewport({ scale: 1 });

                const scale = Math.min(

                    2.5,

                    Math.sqrt(
                        MAX_PIXELS /
                        (
                            naturalViewport.width *
                            naturalViewport.height
                        )
                    )
                );

                const viewport =
                    pdfPage.getViewport({ scale: scale });

                const canvas = createCanvas(
                    Math.ceil(viewport.width),
                    Math.ceil(viewport.height)
                );

                const ctx = canvas.getContext("2d");

                await pdfPage.render({

                    canvasContext: ctx,
                    viewport: viewport,
                    background: "rgb(255,255,255)"

                }).promise;

                pages.push(

                    createPage(
                        `${file.name} — Page ${n}`,
                        canvas
                    )

                );

            } finally {

                pdfPage.cleanup();

            }
        }

    } finally {

        await task.destroy();

    }
}


// 8. IMPORT MULTIPLE FILES

async function addFiles(files) {

    if (busy || cropDialog.open) return;

    busy = true;

    updateControls();

    const errors = [];

    try {

        for (const file of files) {

            try {

                if (pages.length >= MAX_PAGES) {

                    throw new Error(
                        `Maximum ${MAX_PAGES} pages reached.`
                    );

                }

                statusText.textContent =
                    `Loading ${file.name}...`;

                const name = file.name.toLowerCase();

                if (name.endsWith(".pdf")) {

                    await loadPDF(file);

                } else if (/\.(jpg|jpeg|png)$/.test(name)) {

                    const page = await loadImage(file);

                    pages.push(page);

                } else {

                    throw new Error("Unsupported file format.");

                }

            } catch (error) {

                console.error(error);

                errors.push(
                    `${file.name}: ${error.message}`
                );

            }
        }

    } finally {

        busy = false;

        if (pages.length && selectedIndex === -1) {

            selectedIndex = 0;

        }

        progressBar.value = 0;

        renderPages();
        updatePreview();

        statusText.textContent =
            `${pages.length} page(s) ready. ` +
            "Convert again to update extracted text." +
            (errors.length ? " " + errors.join(" | ") : "");

    }
}


fileInput.addEventListener("change", () => {

    const files = Array.from(fileInput.files);

    fileInput.value = "";

    addFiles(files);

});


// 9. DRAG AND DROP

dropZone.addEventListener("dragover", event => {

    event.preventDefault();

    if (!busy) {

        dropZone.classList.add("dragover");

    }
});


dropZone.addEventListener("dragleave", () => {

    dropZone.classList.remove("dragover");

});


dropZone.addEventListener("drop", event => {

    event.preventDefault();

    dropZone.classList.remove("dragover");

    addFiles(Array.from(event.dataTransfer.files));

});


// 10. DRAW IMAGE WITH ROTATION
//     CONTRAST AND BRIGHTNESS

function renderImage(page, target, maxDimension = Infinity) {

    const source = page.base;

    const rotated = page.rotation % 180 !== 0;

    const width = rotated
        ? source.height
        : source.width;

    const height = rotated
        ? source.width
        : source.height;

    const scale = Math.min(
        1,
        maxDimension / Math.max(width, height)
    );

    target.width = Math.max(
        1, Math.round(width * scale)
    );

    target.height = Math.max(
        1, Math.round(height * scale)
    );

    const ctx = target.getContext("2d");

    ctx.fillStyle = "white";

    ctx.fillRect(
        0, 0, target.width, target.height
    );

    ctx.save();

    ctx.translate(
        target.width / 2,
        target.height / 2
    );

    ctx.rotate(page.rotation * Math.PI / 180);

    ctx.scale(scale, scale);

    ctx.drawImage(
        source,
        -source.width / 2,
        -source.height / 2
    );

    ctx.restore();


    // Apply brightness and contrast directly
    // to pixel values for browser compatibility.

    if (
        page.contrast !== 100 ||
        page.brightness !== 100
    ) {

        const imageData = ctx.getImageData(
            0, 0, target.width, target.height
        );

        const pixels = imageData.data;

        const c = page.contrast / 100;
        const b = page.brightness / 100;

        for (let i = 0; i < pixels.length; i += 4) {

            for (let channel = 0; channel < 3; channel++) {

                const value = pixels[i + channel];

                pixels[i + channel] =
                    ((value * b) - 128) * c + 128;

            }
        }

        ctx.putImageData(imageData, 0, 0);

    }

    return target;
}


// 11. CREATE EDITED IMAGE FOR OCR

function getProcessedImage(page) {

    return renderImage(
        page,
        createCanvas(1, 1)
    );
}


// 12. DISPLAY PAGE LIST

function renderPages() {

    pageList.replaceChildren();

    pages.forEach((page, index) => {

        const row = document.createElement("div");

        row.className = "page-item";

        if (index === selectedIndex) {

            row.classList.add("active");

        }

        // Generate a small thumbnail

        const thumb = renderImage(
            page,
            createCanvas(1, 1),
            120
        );

        const image = document.createElement("img");

        image.src = thumb.toDataURL("image/png");
        image.alt = `Page ${index + 1}`;

        const name = document.createElement("div");

        name.className = "page-name";

        name.textContent =
            `${index + 1}. ${page.name}`;

        const controls = document.createElement("div");

        controls.className = "page-controls";


        function button(label, title, action, disabled) {

            const btn = document.createElement("button");

            btn.textContent = label;
            btn.title = title;

            btn.setAttribute("aria-label", title);

            btn.disabled = busy || disabled;

            btn.addEventListener("click", action);

            return btn;
        }


        const edit = button(

            "Edit",
            `Edit page ${index + 1}`,

            () => {

                if (busy) return;

                selectedIndex = index;

                renderPages();
                updatePreview();

            },

            false

        );


        const up = button(

            "↑",
            `Move page ${index + 1} up`,

            () => movePage(index, -1),

            index === 0

        );


        const down = button(

            "↓",
            `Move page ${index + 1} down`,

            () => movePage(index, 1),

            index === pages.length - 1

        );


        const remove = button(

            "✕",
            `Remove page ${index + 1}`,

            () => removePage(index),

            false

        );

        remove.className = "danger";

        controls.append(
            edit, up, down, remove
        );

        row.append(
            image, name, controls
        );

        pageList.appendChild(row);

    });

    updateControls();
}


// 13. MOVE PAGES UP OR DOWN

function movePage(index, direction) {

    if (busy) return;

    const newIndex = index + direction;

    if (
        newIndex < 0 ||
        newIndex >= pages.length
    ) return;

    const selected = pages[selectedIndex];

    [pages[index], pages[newIndex]] =
        [pages[newIndex], pages[index]];

    selectedIndex = pages.indexOf(selected);

    markChanged();

    renderPages();
    updatePreview();

}


// 14. REMOVE PAGE

function removePage(index) {

    if (busy) return;

    const selected = pages[selectedIndex];

    pages.splice(index, 1);

    selectedIndex = pages.indexOf(selected);

    if (selectedIndex === -1 && pages.length) {

        selectedIndex = Math.min(
            index, pages.length - 1
        );

    }

    markChanged();

    renderPages();
    updatePreview();

}


// 15. UPDATE IMAGE PREVIEW

function updatePreview() {

    const page = pages[selectedIndex];

    editorPanel.hidden = !page;

    if (!page) {

        previewCanvas.width = 1;
        previewCanvas.height = 1;

        return;

    }

    $("selectedPage").textContent =
        `Editing page ${selectedIndex + 1}: ${page.name}`;

    contrast.value = page.contrast;
    brightness.value = page.brightness;

    $("contrastValue").textContent =
        `${page.contrast}%`;

    $("brightnessValue").textContent =
        `${page.brightness}%`;

    renderImage(page, previewCanvas, 1200);

}


// 16. MARK EDITED DOCUMENT

function markChanged() {

    progressBar.value = 0;

    statusText.textContent =
        "Pages changed. Convert again to update the text.";

}


// 17. ROTATION

function rotateImage(degrees) {

    if (busy || !pages[selectedIndex]) return;

    const page = pages[selectedIndex];

    page.rotation =
        (page.rotation + degrees + 360) % 360;

    markChanged();

    updatePreview();
    renderPages();

}


$("rotateLeft").addEventListener(
    "click",
    () => rotateImage(-90)
);


$("rotateRight").addEventListener(
    "click",
    () => rotateImage(90)
);


// 18. CONTRAST AND BRIGHTNESS

contrast.addEventListener("input", () => {

    if (busy || !pages[selectedIndex]) return;

    pages[selectedIndex].contrast =
        Number(contrast.value);

    markChanged();

    updatePreview();

});


brightness.addEventListener("input", () => {

    if (busy || !pages[selectedIndex]) return;

    pages[selectedIndex].brightness =
        Number(brightness.value);

    markChanged();

    updatePreview();

});


contrast.addEventListener("change", renderPages);
brightness.addEventListener("change", renderPages);


// 19. RESET IMAGE

$("resetBtn").addEventListener("click", () => {

    if (busy || !pages[selectedIndex]) return;

    const page = pages[selectedIndex];

    page.base = page.original;

    page.rotation = 0;
    page.contrast = 100;
    page.brightness = 100;

    markChanged();

    updatePreview();
    renderPages();

});


// 20. OPEN CROP EDITOR

$("cropBtn").addEventListener("click", () => {

    if (busy || !pages[selectedIndex]) return;

    if (typeof Cropper === "undefined") {

        statusText.textContent =
            "Crop library could not load.";

        return;

    }

    cropPage = pages[selectedIndex];

    // Apply rotation before cropping,
    // but keep brightness and contrast adjustable.

    const cropSource = getProcessedImage({

        ...cropPage,

        contrast: 100,
        brightness: 100

    });

    cropImage.src =
        cropSource.toDataURL("image/png");

    cropDialog.showModal();

    $("applyCrop").disabled = true;

    try {

        cropper = new Cropper(cropImage, {

            viewMode: 1,

            dragMode: "crop",

            autoCropArea: 0.85,

            responsive: true,

            movable: true,

            zoomable: true,

            background: false,

            ready() {

                $("applyCrop").disabled = false;

            }

        });

    } catch (error) {

        cropDialog.close();

        statusText.textContent =
            `Could not open crop editor: ${error.message}`;

    }

});


// 21. APPLY IMAGE CROP

$("applyCrop").addEventListener("click", () => {

    if (!cropper || !cropPage) return;

    const croppedCanvas = cropper.getCroppedCanvas({

        fillColor: "#ffffff",

        maxWidth: 6000,
        maxHeight: 6000,

        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high"

    });

    if (
        !croppedCanvas ||
        !croppedCanvas.width ||
        !croppedCanvas.height
    ) return;

    cropPage.base = croppedCanvas;

    cropPage.rotation = 0;

    cropDialog.close();

    markChanged();

    updatePreview();
    renderPages();

});


$("cancelCrop").addEventListener("click", () => {

    cropDialog.close();

});


cropDialog.addEventListener("close", () => {

    if (cropper) {

        cropper.destroy();

        cropper = null;

    }

    cropPage = null;

    cropImage.removeAttribute("src");

});


// 22. ENABLE OR DISABLE CONTROLS

function updateControls() {

    fileInput.disabled = busy;

    document.querySelector(".upload-label")
        .classList.toggle("disabled", busy);

    $("convertBtn").disabled =
        busy || pages.length === 0;

    $("clearBtn").disabled =
        busy || (pages.length === 0 && !output.value);

    $("language").disabled = busy;

    const editorDisabled =
        busy || !pages[selectedIndex];

    [

        "rotateLeft",
        "rotateRight",
        "cropBtn",
        "resetBtn",
        "contrast",
        "brightness"

    ].forEach(id => {

        $(id).disabled = editorDisabled;

    });

    output.readOnly = busy;

    ["copyBtn", "downloadBtn", "shareBtn"]
        .forEach(id => {

            $(id).disabled =
                busy || !output.value.trim();

        });

}


// 23. CLEAR ALL DOCUMENTS

$("clearBtn").addEventListener("click", () => {

    if (busy) return;

    if (
        !confirm(
            "Remove all pages and extracted text?"
        )
    ) return;

    pages = [];

    selectedIndex = -1;

    output.value = "";

    progressBar.value = 0;

    statusText.textContent =
        "Waiting for documents...";

    $("outputStatus").textContent = "";

    renderPages();
    updatePreview();

});


// 24. CONVERT ALL PAGES WITH OCR

$("convertBtn").addEventListener("click", async () => {

    if (busy || pages.length === 0) return;

    if (typeof Tesseract === "undefined") {

        statusText.textContent =
            "OCR library could not load.";

        return;

    }

    if (
        output.value.trim() &&
        !confirm("Replace the existing text?")
    ) return;

    busy = true;

    progressBar.value = 0;

    const previousText = output.value;

    output.value = "";

    $("outputStatus").textContent = "";

    renderPages();

    const results = [];

    const total = pages.length;

    let worker = null;

    let currentPage = 0;

    try {

        statusText.textContent =
            "Loading Tigrinya OCR language model...";

        worker = await Tesseract.createWorker(

            $("language").value,

            1,

            {

                logger(message) {

                    if (
                        message.status === "recognizing text"
                    ) {

                        const fraction = Math.max(

                            0,

                            Math.min(
                                1,
                                message.progress || 0
                            )

                        );

                        const percent = Math.round(

                            ((currentPage + fraction)
                            / total) * 100

                        );

                        progressBar.value = percent;

                        statusText.textContent =
                            `Processing page ${currentPage + 1}` +
                            ` of ${total} — ${percent}%`;

                    } else {

                        statusText.textContent =
                            message.status || "Loading OCR...";

                    }

                }

            }

        );


        for (let i = 0; i < total; i++) {

            currentPage = i;

            statusText.textContent =
                `Preparing page ${i + 1} of ${total}...`;

            // OCR uses the edited canvas.

            const canvas =
                getProcessedImage(pages[i]);

            const blob = await canvasToBlob(canvas);

            // Release temporary canvas memory.

            canvas.width = 1;
            canvas.height = 1;

            const result = await worker.recognize(blob);

            results.push(
                result.data.text.trim()
            );

            output.value =
                results.join("\n\n");

            progressBar.value = Math.round(
                ((i + 1) / total) * 100
            );

        }


        progressBar.value = 100;

        statusText.textContent =
            `Completed! ${total} page(s) converted. ` +
            "Please review the extracted text.";

    } catch (error) {

        console.error(error);

        if (!results.length) {

            output.value = previousText;

        }

        statusText.textContent =
            `OCR failed after ${results.length} page(s): ` +
            error.message;

    } finally {

        if (worker) {

            try {

                await worker.terminate();

            } catch (error) {

                console.error(error);

            }

        }

        busy = false;

        renderPages();

    }

});


// 25. COPY TEXT

async function copyText() {

    if (!output.value.trim()) return;

    try {

        await navigator.clipboard.writeText(
            output.value
        );

        $("outputStatus").textContent =
            "Text copied successfully!";

    } catch (error) {

        output.focus();
        output.select();

        $("outputStatus").textContent =
            "Text selected. Press Ctrl+C or Cmd+C to copy.";

    }
}


$("copyBtn").addEventListener("click", copyText);


// 26. DOWNLOAD TEXT FILE

$("downloadBtn").addEventListener("click", () => {

    if (!output.value.trim()) return;

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

    $("outputStatus").textContent =
        "Text file download started.";

});


// 27. SHARE EXTRACTED TEXT

$("shareBtn").addEventListener("click", async () => {

    const text = output.value.trim();

    if (!text) return;

    const shareData = {

        title: "Ivy Tools — Tigrinya OCR",

        text: text

    };

    try {

        if (

            navigator.share &&

            (
                !navigator.canShare ||
                navigator.canShare(shareData)
            )

        ) {

            await navigator.share(shareData);

            $("outputStatus").textContent =
                "Text passed to sharing service.";

        } else {

            await copyText();

            $("outputStatus").textContent +=
                " Native sharing is unavailable. " +
                "Paste the text into your preferred app.";

        }

    } catch (error) {

        if (error.name !== "AbortError") {

            $("outputStatus").textContent =
                "Could not share. Use Copy Text instead.";

        }

    }

});


// 28. UPDATE OUTPUT CONTROLS

output.addEventListener("input", updateControls);


// 29. INITIALIZE APPLICATION

renderPages();

updatePreview();

updateControls();
