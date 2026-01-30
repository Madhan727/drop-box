document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileListContainer = document.getElementById('file-list-container');
    const globalContextInput = document.getElementById('global-context');
    const btnDrop = document.getElementById('btn-drop');
    const dropSection = document.getElementById('drop-section');
    const dropSuccess = document.getElementById('drop-success');
    const generatedCodeDisplay = document.getElementById('generated-code');

    // Retrieve Elements
    const retrieveCodeInput = document.getElementById('retrieve-code');
    const btnRetrieve = document.getElementById('btn-retrieve');
    const retrievedContent = document.getElementById('retrieved-content');
    const retrievedContext = document.getElementById('retrieved-context');
    const retrievedFiles = document.getElementById('retrieved-files');
    const btnDownloadAll = document.getElementById('btn-download-all');

    // State
    let filesToUpload = []; // Array of {file: File, path: string}

    // --- Drop Logic ---
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        const items = e.dataTransfer.items;
        if (items) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
                if (item) {
                    await scanFiles(item);
                }
            }
        }
        updateFileList();
    });

    fileInput.addEventListener('change', (e) => {
        for (let file of e.target.files) {
            filesToUpload.push({
                file: file,
                path: file.name
            });
        }
        updateFileList();
    });

    async function scanFiles(item, path = '') {
        if (item.isFile) {
            item.file(file => {
                filesToUpload.push({
                    file: file,
                    path: path + file.name
                });
                updateFileList();
            });
        } else if (item.isDirectory) {
            const dirReader = item.createReader();
            const readEntries = () => {
                dirReader.readEntries(async (entries) => {
                    if (entries.length === 0) return;
                    for (let entry of entries) {
                        await scanFiles(entry, path + item.name + "/");
                    }
                    readEntries(); // Continue reading in case of many files
                });
            };
            readEntries();
        }
    }

    function updateFileList() {
        fileListContainer.innerHTML = '';
        if (filesToUpload.length > 5) {
            alert("Limit: Max 5 files allowd (Folders count as their contents). Trimming.");
            filesToUpload = filesToUpload.slice(0, 5);
        }

        filesToUpload.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'file-item';
            div.innerHTML = `
                <span>${item.path}</span>
                <span style="cursor:pointer; color: #ef4444;" onclick="removeFile(${index})">×</span>
            `;
            fileListContainer.appendChild(div);
        });
    }

    window.removeFile = (index) => {
        filesToUpload.splice(index, 1);
        updateFileList();
    };

    btnDrop.addEventListener('click', async () => {
        if (filesToUpload.length === 0) {
            alert('Please add files.');
            return;
        }
        const context = globalContextInput.value.trim();
        if (!context) {
            alert('Context message is mandatory.');
            return;
        }

        const formData = new FormData();
        formData.append('global_context', context);

        // Append all files and their relative paths
        filesToUpload.forEach(item => {
            formData.append('files', item.file);
            formData.append('relative_paths', item.path);
        });

        // CSRF Token
        const csrfToken = getCookie('csrftoken');

        btnDrop.textContent = 'Uploading...';
        btnDrop.disabled = true;

        try {
            const response = await fetch('/upload/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken
                },
                body: formData
            });

            const data = await response.json();
            if (response.ok) {
                // Show Success
                dropSection.style.display = 'none';
                dropSuccess.style.display = 'block';
                generatedCodeDisplay.textContent = data.code;
            } else {
                alert('Error: ' + data.error);
                btnDrop.disabled = false;
                btnDrop.textContent = 'Drop Files';
            }
        } catch (err) {
            console.error(err);
            alert('Upload failed.');
            btnDrop.disabled = false;
            btnDrop.textContent = 'Drop Files';
        }
    });

    // --- Retrieve Logic ---
    btnRetrieve.addEventListener('click', async () => {
        const code = retrieveCodeInput.value.trim();
        if (code.length !== 6) {
            alert('Please enter a valid 6-digit code.');
            return;
        }

        try {
            const response = await fetch(`/retrieve/?code=${code}`);
            const data = await response.json();

            if (response.ok) {
                retrievedContent.style.display = 'block';
                retrievedContext.textContent = data.global_context;
                retrievedFiles.innerHTML = '';

                data.files.forEach(f => {
                    const div = document.createElement('div');
                    div.className = 'file-item';
                    div.innerHTML = `
                        <span>${f.path} (${formatBytes(f.size)})</span>
                        <a href="/download/${f.id}/" style="color: var(--primary); text-decoration: none;">Download</a>
                    `;
                    retrievedFiles.appendChild(div);
                });

                btnDownloadAll.onclick = () => {
                    window.location.href = `/download-folder/${data.code}/`;
                };
            } else {
                alert(data.error);
            }
        } catch (err) {
            console.error(err);
            alert('Retrieval failed.');
        }
    });

    // Helper
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }
});
