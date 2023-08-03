const puppeteer = require("puppeteer");
const sqlite3 = require("sqlite3");

const db = new sqlite3.Database("./db.sqlite");

(async function main() {
  const browser = await puppeteer.launch({
    defaultViewport: { width: 1400, height: 900 },
  });

  const url = "https://dstock.vndirect.com.vn/d-rating-chuyen-sau/HPG";
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
  );
  await page.goto(url);
  await page.waitForSelector(".drating-box__main", {
    visible: true,
    timeout: 5000,
  });

  const data = await page.$$eval(".drating-box__main table tr td", (tds) =>
    tds.map((td, index) => {
      return td.innerText;
    })
  );

  const perChunk = 4 // items per chunk    
  const result = data.reduce((resultArray, item, index) => {
    const chunkIndex = Math.floor(index / perChunk)

    if (!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = [] // start a new chunk
    }

    resultArray[chunkIndex].push(item)

    return resultArray
  }, [])


  db.serialize(() => {
    db.prepare('INSERT INTO "data" ("value", "url", "createdDate") VALUES (?, ?, ?)')
      .run(JSON.stringify(result), url, new Date)
      .finalize();
  });

  // wait for db to be closed before exit
  await new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  console.log(result);

  process.exit(0);
})();
