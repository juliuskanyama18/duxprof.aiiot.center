document.getElementById("upload-form").addEventListener("submit", function (event) {
    event.preventDefault();

    const fileInput = document.getElementById("pdf-file");
    const file = fileInput.files[0];

    if (file) {
        const formData = new FormData();
        formData.append('pdfFile', file);

        fetch('/uploadPdf', {
            method: 'POST',
            body: formData
          })
            .then(response => response.json())
            .then(data => {
              if (!data.fileName) {
                throw new Error("Invalid response from server");
              }
              const pdfName = data.fileName;
              window.location.href = `/convertPdf?pdfName=${encodeURIComponent(pdfName)}`;
            })
            .catch(error => {
              console.error("Error uploading PDF:", error);
            });
    }
});