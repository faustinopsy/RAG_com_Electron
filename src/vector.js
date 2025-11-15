// src/renderer/vector.js
import Plotly from 'plotly.js-dist-min';

// Pede os dados 3D ao back-end assim que a janela abre
window.api.getVectorData().then(plotData => {
  if (!plotData || plotData.x.length === 0) {
    document.getElementById('plot').innerText = "Nenhum dado encontrado. Faça a ingestão de um PDF primeiro.";
    return;
  }

  // Configuração do Plotly
  const data = [{
    x: plotData.x,
    y: plotData.y,
    z: plotData.z,
    text: plotData.text, // O texto que aparece ao passar o rato
    mode: 'markers',
    type: 'scatter3d',
    marker: {
      size: 5,
      color: plotData.z, // Colore os pontos pelo eixo Z
      colorscale: 'Viridis',
      opacity: 0.8
    }
  }];

  const layout = {
    title: 'Visualização 3D dos Embeddings (PCA)',
    margin: { l: 0, r: 0, b: 0, t: 40 }
  };

  // Desenha o gráfico
  Plotly.newPlot('plot', data, layout);

}).catch(err => {
  console.error("Falha ao desenhar gráfico:", err);
  document.getElementById('plot').innerText = `Erro: ${err.message}`;
});