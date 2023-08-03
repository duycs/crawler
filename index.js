const puppeteer = require("puppeteer");
const sqlite3 = require("sqlite3");
const config = require('config');
const nodeCron = require("node-cron");

const db = new sqlite3.Database("./db.sqlite");

(async function main() {
  try {
    const crawlerConfigs = config.get("crawlers");

    if (!crawlerConfigs || crawlerConfigs.length < 0) {
      console.log("Not found any crawler config");
      return;
    }

    crawlerConfigs.forEach(async crawler => {
      console.log("crawler", crawler);

      switch (crawler.code) {
        case "dstock.vndirect.com.vn":
          if (crawler.schedule) {
            nodeCron.schedule(crawler.scheduleExpressions, () => crawlDstockVndirect(crawler));
          } else {
            console.log("here")
            await crawlDstockVndirect(crawler);
          }
          break;

        default:
          break;
      }
    });

    //process.exit(0);
  } catch (err) {
    console.log(error);
  }
})();

async function crawlDstockVndirect(crawler) {
  try {
    console.log("Open browser");

    const browser = await puppeteer.launch({
      defaultViewport: {
        width: 1400,
        height: 900
      },
    });

    console.log(`Scraping page ${crawler.url}`);

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    );

    const waitSelector = ".drating-box__main";
    const selector = ".drating-box__main table tr td";

    await page.goto(crawler.url);
    await page.waitForSelector(waitSelector, {
      visible: true,
      timeout: 5000,
    });

    const data = await page.$$eval(selector, (tds) =>
      tds.map((td, index) => {
        return td.innerText;
      })
    );

    var result = chunkTable(data, 4);

    await saveData(crawler, result, db);

    console.log("Closing browser");

    await browser.close();

    console.log(`data: ${result}`);

  } catch (error) {
    console.log(error);
  }
}

async function saveData(crawler, result, db) {
  db.serialize(() => {
    db.prepare(`INSERT INTO ${crawler.dataTable} ("value", "url", "createdDate") VALUES (?, ?, ?)`)
      .run(JSON.stringify(result), crawler.url, new Date)
      .finalize();
  });

  // wait for db to be closed before exit
  await new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
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