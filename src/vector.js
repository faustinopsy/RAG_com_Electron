import Plotly from 'plotly.js-dist-min';

window.api.getVectorData().then(plotData => {
  if (!plotData || plotData.x.length === 0) {
    document.getElementById('plot').innerText = "Nenhum dado encontrado. Faça a ingestão de um PDF primeiro.";
    return;
  }

  const data = [{
    x: plotData.x,
    y: plotData.y,
    z: plotData.z,
    text: plotData.text, 
    mode: 'markers',
    type: 'scatter3d',
    marker: {
      size: 5,
      color: plotData.z,
      colorscale: 'Viridis',
      opacity: 0.8
    }
  }];

  const layout = {
    title: 'Visualização 3D dos Embeddings (PCA)',
    margin: { l: 0, r: 0, b: 0, t: 40 }
  };

  Plotly.newPlot('plot', data, layout);

}).catch(err => {
  console.error("Falha ao desenhar gráfico:", err);
  document.getElementById('plot').innerText = `Erro: ${err.message}`;
});