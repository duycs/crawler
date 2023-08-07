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
        text: "https://dstock.vndirect.com.vn",
      },
    },
  },
};

new Chart(document.getElementById("stockLineChart"), config);
