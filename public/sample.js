const config = {
  type: "line",
  data: window.__DATA__,
  options: {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Chỉ số tăng trường",
      },
    },
  },
};

new Chart(document.getElementById("stockLineChart"), config);
