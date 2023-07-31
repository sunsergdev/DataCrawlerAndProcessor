import axios, { AxiosError } from "axios";
import { parse } from "node-html-parser";
import fs, { promises as fsPromises } from "fs";
import { parse as csv_parser } from "csv-parse";

import { stringify } from "csv-stringify";
import { error, log } from "console";
import * as AxiosLogger from "axios-logger";
import { createLogger, transports, format } from "winston";

const user_agents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  "Mozilla/5.0 (Linux; Android 11; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Mobile Safari/537.36",
];

const loggerStream = fs.createWriteStream("failure.log");

const instance = axios.create({
  headers: {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language":
      "en-IN,en;q=0.9,hi-IN;q=0.8,hi;q=0.7,fr-FR;q=0.6,fr;q=0.5,en-US;q=0.4,en-GB;q=0.3",
    "Cache-Control": "no-cache",
  },
  validateStatus: function (status) {
    console.log(status);
    return status >= 200 && status < 300; // default
  },
});

const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "myntra_parser" },
  transports: [
    new transports.File({ filename: "quick-start-error.log", level: "error" }),
    new transports.File({ filename: "quick-start-combined.log" }),
  ],
});

AxiosLogger.setGlobalConfig({
  params: true,
  logger: logger.log,
});

instance.interceptors.request.use(
  (x) => x,
  (error) => {
    logger.error(error);
    return error;
  }
);
instance.interceptors.response.use(
  (x) => x,
  (error) => {
    logger.error(error);
    return error;
  }
);

const window = {};
// instance.get(product).then((response) => {
//   const html = response.data;
//   var doc = parse(html, "text/html");
//   var script = doc
//     .getElementsByTagName("script")
//     .find((h2) => h2.rawText.startsWith("window.__myx = ")).rawText;
//   const productArticleDetails = eval(script);
//   console.log(productArticleDetails["pdpData"]);
// });

const cookie = ``;
const columns = [
  "id",
  "category",
  "sub_category",
  "gender",
  "brand",
  "mrp",
  "price",
  "rating",
  "rating_count",
  "season",
  "item_url",
];

async function fetchAllUrls() {
  const articlesFile = `articles.csv`;
  const stringifier = stringify({
    delimiter: ",",
    header: !fs.existsSync(articlesFile),
    columns: columns,
  });
  const writableStream = fs.createWriteStream(articlesFile, { flags: "a" });
  stringifier.pipe(writableStream);
  let hasNextPage = true;
  let currentOffset = 494600;

  while (hasNextPage) {
    await instance
      .get(
        `https://www.myntra.com/gateway/v2/search/clothing?f=Categories%3ABlazers%2CBodysuit%2CCamisoles%2CCapris%2CChuridar%2CClothing%20Set%2CCo-Ords%2CCoats%2CCorset%2CDresses%2CHarem%20Pants%2CJackets%2CJeans%2CJeggings%2CJumpsuit%2CKurtas%2CKurtis%2CLeggings%2CLounge%20Pants%2CLounge%20Shorts%2CLounge%20Tshirts%2CNehru%20Jackets%2CNight%20suits%2CNightdress%2CPalazzos%2CRompers%2CSaree%20Blouse%2CSarees%2CSherwani%2CShirts%2CShorts%2CShrug%2CSkirts%2CSuits%2CSweaters%2CSweatshirts%2CTights%2CTops%2CTrack%20Pants%2CTracksuits%2CTrousers%2CTshirts%2CTunics%3A%3AGender%3Amen%2Cmen%20women%2Cwomen&rows=100&o=${currentOffset}`,
        {
          headers: {
            "User-Agent":
              user_agents[Math.floor(Math.random() * user_agents.length)],
            Cookie: cookie,
            Origin: "https://www.myntra.com",
          },
        }
      )
      .then((response) => {
        return response.data;
      })
      .then((data) => {
        hasNextPage = data["hasNextPage"];
        const products = data["products"];
        products.forEach((product) => {
          const row = [
            product["productId"],
            product["category"],
            product["subCategory"]["typeName"],
            product["gender"],
            product["brand"],
            product["mrp"],
            product["price"],
            product["rating"],
            product["ratingCount"],
            product["season"],
            `https://www.myntra.com/${product["landingPageUrl"]}`,
          ];
          stringifier.write(row);
        });
        console.log("Finished page: ", currentOffset);
        currentOffset += 100;
      })
      .catch((e) => {
        if (e instanceof AxiosError) {
          console.log(e);
        }
      });
  }
}

const articlesDirectory = `myntra/articles`;
try {
  fs.mkdirSync(articlesDirectory, { recursive: true });
} catch (e) {
  if (e.code != "EEXIST") throw e;
}

function fetchAllArticles(ids) {
  console.log("ids", ids);
  const articlesFile = `articles_cleaned.csv`;
  const readableStream = fs.createReadStream(articlesFile).pipe(
    csv_parser({
      delimiter: ",",
      from_line: 2,
    })
  );

  let rowSuccess = 0;
  let rowFailed = 0;
  let batch = 0;
  readableStream.on("data", (data) => {
    if (
      fs.existsSync(`${articlesDirectory}/${data[0]}.json`) &&
      !ids.includes(data[0])
    ) {
      rowSuccess++;
      // console.log("completed: ", rowSuccess);
    } else {
      batch++;
      if (batch == 100) {
        readableStream.pause();
      }
      crawlArticle(data)
        .then(() => {
          rowSuccess++;
          // console.log("completed: ", rowSuccess);
        })
        .catch(() => {
          rowFailed++;
          console.log("row failed: ", rowFailed);
        })
        .finally(() => {
          batch--;
          if (readableStream.isPaused() && batch < 100) {
            readableStream.resume();
          }
        });
    }
  });
}

async function crawlArticle(article) {
  return crawlArticleByUrl(article[0], article[10]);
}

async function crawlArticleByUrl(id, url) {
  console.log("Crawling", id, url);
  return instance
    .get(url, {
      headers: {
        "User-Agent":
          user_agents[Math.floor(Math.random() * user_agents.length)],
        Cookie: cookie,
        Origin: "https://www.myntra.com",
      },
    })
    .then(function (response) {
      return response.data;
    })
    .then(function (html) {
      var doc = parse(html, "text/html");

      var script = doc
        .getElementsByTagName("script")
        .find((h2) => h2.rawText.startsWith("window.__myx = ")).rawText;
      return eval(script);
    })
    .then((productArticleDetails) => {
      try {
        fsPromises.writeFile(
          `${articlesDirectory}/${id}.json`,
          JSON.stringify(productArticleDetails["pdpData"])
        );
      } catch (e) {
        console.error("Error", e);
      }
    })
    .catch(function (err) {
      // There was an error
      if (err instanceof AxiosError) {
        console.log(err.code, data[0]);
      }
      console.error("Error", err);
    });
}

// await fetchAllUrls();
// fetchAllArticles();

import { createInterface } from "readline";

function fetchRemainingProducts() {
  const readableStream = fs.createReadStream("myntra/remaining_products");
  const rl = createInterface({
    input: readableStream,
    crlfDelay: Infinity,
  });

  const ids = [];
  rl.on("line", (line) => {
    ids.push(line);
  });

  rl.on("close", () => {
    fetchAllArticles(ids);
  });
}

fetchRemainingProducts();
