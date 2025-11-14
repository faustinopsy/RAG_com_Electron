import './index.css';
document.addEventListener('DOMContentLoaded', () => {

  const uploadButton = document.getElementById('upload-pdf-button');
  const uploadStatus = document.getElementById('upload-status');

  // Verifica se os elementos existem
  if (uploadButton && uploadStatus) {
    
    // Adiciona o "ouvinte" de clique ao botão
    uploadButton.addEventListener('click', async () => {
      
      // Limpa o status anterior
      uploadStatus.textContent = 'Abrindo caixa de diálogo...';

      try {
        // 1. Pede ao back-end para abrir a caixa de diálogo
        //    (usa a função que criamos no preload)
        const filePath = await window.api.openFile();

        if (filePath) {
          // 2. Se um arquivo foi selecionado, envia para ingestão
          uploadStatus.textContent = `Processando arquivo: ${filePath}`;
          
          //    (usa a outra função que criamos no preload)
          const result = await window.api.ingestPDF(filePath);

          // 3. Mostra o resultado final
          if (result.success) {
            uploadStatus.textContent = `Sucesso! ${result.message}`;
          } else {
            uploadStatus.textContent = `Erro: ${result.message}`;
          }
        } else {
          // O usuário cancelou a caixa de diálogo
          uploadStatus.textContent = 'Seleção de arquivo cancelada.';
        }

      } catch (error) {
        // Mostra um erro caso algo na comunicação falhe
        console.error('Erro no processo de upload:', error);
        uploadStatus.textContent = `Erro fatal: ${error.message}`;
      }
    });
  }
});
