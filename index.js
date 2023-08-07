const http = require("http");
const express = require('express');
const puppeteer = require("puppeteer");
const sqlite3 = require("sqlite3");
const config = require('config');
const nodeCron = require("node-cron");
var moment = require('moment');

const app = express();
const server = http.createServer(app);

app.use(express.static('public'));
app.set('view engine', 'pug')
app.use("/", async (req, res) => {
  const crawlerConfigs = config.get("crawlers");
  const db = initConnection();

  crawlerConfigs.forEach(async crawler => {
    switch (crawler.page) {
      case "https://dstock.vndirect.com.vn":
        let sql = `SELECT code, createdDate, value FROM (SELECT DISTINCT code, strftime('%d-%m-%Y', createdDate) as createdDate, value FROM ${crawler.dataTable}) ORDER BY createdDate`;
        db.all(sql, [], (err, rows) => {
          if (err) {
            return res.status(500);
          }
          res.render('index', { data: initDataDstockVndirectToChart(crawler, rows) });
        });

        break;

      default:
        break;
    }
  });
});

server.listen(config.server.port);

var totalUrlNeedCrawl = 0;
var totalCrawlDone = 0;
var intervalCrawl;
var isConnectionClosed = false;
var crawlTime = 0;

(async function main() {
  try {
    const crawlerConfigs = config.get("crawlers");

    if (!crawlerConfigs || crawlerConfigs.length < 0) {
      console.log("Not found any crawler config");
      return;
    }

    console.log("Open browser");

    const browser = await puppeteer.launch({
      defaultViewport: {
        width: 1400,
        height: 900
      },
    });

    crawlerConfigs.forEach(async crawler => {
      console.log("crawler", crawler);

      switch (crawler.page) {
        case "https://dstock.vndirect.com.vn":
          if (crawler.schedule) {
            console.log(`crawl schedule at ${crawler.scheduleExpressions}`);
            nodeCron.schedule(crawler.scheduleExpressions, () => crawlDstockVndirects(browser, crawler));
          } else {
            await crawlDstockVndirects(browser, crawler);
          }
          break;

        default:
          break;
      }
    });

  } catch (err) {
    console.log(err);
  }
})();

function initDataDstockVndirectToChart(crawler, rows) {
  let result = [];
  let firstValues = [];

  for (let i = 0; i < rows.length; ++i) {
    let row = rows[i];
    let value = JSON.parse(row.value);

    firstValues.push({
      label: row.code,
      data: value[0][1],
      createdDate: row.createdDate
    });

  }

  console.log(firstValues);

  // loop date in month get data stock
  let days = getDaysInMonth();

  crawler.codes.forEach(code => {
    let dataCodeByDays = {
      label: code,
      data: [],
      days: []
    }

    for (let i = 0; i < days.length; ++i) {
      let datas = firstValues.filter(v => v.label === code && v.createdDate === days[i]);
      
      dataCodeByDays.days.push(days[i]);

      if (datas && datas.length > 0) {
        let data = datas[0].data;
        dataCodeByDays.data.push(data);
      } else {
        dataCodeByDays.data.push(0);
      }
    }

    result.push(dataCodeByDays);

  });

  let chartData = {
    labels: days,
    datasets: result
  }

  console.log("chartData", chartData);

  return chartData;
}

function getDaysInMonth(month, year) {
  month = month | new Date().getMonth();
  year = year | new Date().getFullYear();

  console.log("get days of: ", month, year);

  var date = moment(new Date(year, month, 1));
  var days = [];
  while (date.month() === month) {
    days.push(moment(date).format('DD-MM-YYYY'));
    date.date(date.date() + 1);
  }

  return days;
}

async function checkCloseConnections(db, browser) {
  try {
    if (isConnectionClosed) {
      intervalCrawl = null; // clean interval
    } else if (totalUrlNeedCrawl === totalCrawlDone) {
      isConnectionClosed = true;

      console.log("close all connections");

      console.log("close database connection");

      await new Promise((resolve, reject) => {
        db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      //await browser.close();

      // process.exit(0);
    }
  } catch (error) {
    intervalCrawl = null;
    console.log("ignore error", error);
  }
}

function initConnection() {
  console.log("init database connection");
  return db = new sqlite3.Database("./db.sqlite");
}

async function crawlDstockVndirects(browser, crawler) {
  isConnectionClosed = false;
  crawlTime++;
  console.log("crawl time:", crawlTime);

  const db = initConnection();

  try {
    let urls = [];
    if (crawler.codes && crawler.codes.length > 0) {
      crawler.codes.forEach((param, i) => {
        let url = crawler.pageRegex;
        url = url.replace("{1}", param);
        urls.push(url);
      })
    }

    if (urls.length > 0) {
      totalUrlNeedCrawl += urls.length;
      for (let i = 0; i < urls.length; ++i) {
        await crawlDstockVndirect(db, browser, crawler, urls[i], crawler.codes[i], i);
      }
    }

    // TODO: setup session
    // intervalCrawl = setInterval(async function () {
    //   await checkCloseConnections(db, browser);
    // }, 1000);

  } catch (error) {
    console.log(error);
    throw error;
  }
}

async function crawlDstockVndirect(db, browser, crawler, url, code, index) {
  try {
    console.log("page", index);

    totalCrawlDone += 1;

    let page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    );

    const waitSelector = ".drating-box__main";
    const selector = ".drating-box__main table tr td";

    await page.goto(url);
    await page.waitForSelector(waitSelector, {
      visible: true,
      timeout: 5000,
    });

    let data = await page.$$eval(selector, (tds) =>
      tds.map((td, index) => {
        return td.innerText;
      })
    );

    let result = chunkTable(data, 4);

    console.log(`data: ${result}`);

    await saveData(db, crawler, url, code, result);

    page.close();

  } catch (error) {
    console.log(error);
    totalCrawlDone += 1;
  }
}

async function saveData(db, crawler, url, code, result) {
  try {
    db.serialize(() => {
      db.prepare(`INSERT INTO ${crawler.dataTable} ("value", "url", "code", "createdDate") VALUES (?, ?, ?, ?)`)
        .run(JSON.stringify(result), url, code, (new Date()).toISOString())
        .finalize();
    });
  } catch (error) {
    console.log("save data error", error);
    throw error;
  }
}

function chunkTable(array, perChunk) {
  if (perChunk < 2) return array;

  const result = array.reduce((resultArray, item, index) => {
    const chunkIndex = Math.floor(index / perChunk)

    if (!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = [] // start a new chunk
    }

    resultArray[chunkIndex].push(item)

    return resultArray
  }, [])

  return result;
}