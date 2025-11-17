import './index.css';
document.addEventListener('DOMContentLoaded', async() => {

  const uploadButton = document.getElementById('upload-pdf-button');
  const uploadStatus = document.getElementById('upload-status');
  if (uploadButton && uploadStatus) {
    uploadButton.addEventListener('click', async () => {
    uploadStatus.textContent = 'Abrindo caixa de diálogo...';

      try {
        const filePath = await window.api.openFile();
        if (filePath) {
          uploadStatus.textContent = `Processando arquivo: ${filePath}`;
          const result = await window.api.ingestPDF(filePath);
          if (result.success) {
            uploadStatus.textContent = `Sucesso! ${result.message}`;
          } else {
            uploadStatus.textContent = `Erro: ${result.message}`;
          }
        } else {
          uploadStatus.textContent = 'Seleção de arquivo cancelada.';
        }

      } catch (error) {
        console.error('Erro no processo de upload:', error);
        uploadStatus.textContent = `Erro fatal: ${error.message}`;
      }
    });
  }


  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSendButton = document.getElementById('chat-send-button');

  if (chatMessages && chatInput && chatSendButton) {

    function addMessage(sender, message) {
      const messageElement = document.createElement('p');
      messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
      chatMessages.appendChild(messageElement);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function handleSendQuestion() {
      const question = chatInput.value;
      if (question.trim() === '') {
        return;
      }

      addMessage('Você', question);
      chatInput.value = ''; 
      addMessage('IA', 'Pensando...');
      chatInput.focus();
      try {
        const answer = await window.api.askRAG(question);
        const thinkingMessage = chatMessages.lastChild;
        thinkingMessage.innerHTML = `<strong>IA:</strong> ${answer}`;

      } catch (error) {
        console.error('Erro ao perguntar ao RAG:', error);
        const thinkingMessage = chatMessages.lastChild;
        thinkingMessage.innerHTML = `<strong>IA:</strong> Erro: ${error.message}`;
      }
    }

    chatSendButton.addEventListener('click', handleSendQuestion);

    chatInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        handleSendQuestion();
      }
    });

  }

  const open3DButton = document.getElementById('open-3d-view');
  if (open3DButton) {
    open3DButton.addEventListener('click', () => {
      window.api.getVectorData();
      window.api.openVectorWindow();
    });
  }
});