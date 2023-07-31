import { parse } from "node-html-parser";
import { parse as csv_parser } from "csv-parse";
import fs from "fs";
import { stringify } from "csv-stringify";
import axios from "axios";
import { AxiosError } from "axios";

// A - Bust
// B - Waist
// C - Unfound
// D - Hip
// E - Length-Shoulder-to-Hem
// F - Length-Waist-to-Hem
// G - Pants-Inside-Leg
// H - Front-Rise-Waist-to-Crotch
// I - Unfound
// J - Sleeve-Length-Neck-to-Hem
const baseUrl = "https://www.birdsnest.com.au";
const user_agents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  "Mozilla/5.0 (Linux; Android 11; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Mobile Safari/537.36",
];

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
    return status >= 200 && status < 300; // default
  },
});

// Helper class just to make sure script executes correctly.
// It's a hack
class StencilBootstrap {
  constructor(product) {
    this.product = product;
  }

  load() {
    return this.product;
  }
}

const window = {
  stencilBootstrap: (product, product_json) => {
    const output = new StencilBootstrap(product_json);
    return output;
  },
};

const brandDirectory = "birdnest";
const articlesDirectory = `${brandDirectory}/articles`;

try {
  fs.mkdirSync(articlesDirectory, { recursive: true });
} catch (e) {
  if (e.code != "EEXIST") throw e;
}

function fetchAllUrls() {
  const totalStyle = 5542;
  const perPage = 48;
  const numPages = Math.ceil(totalStyle / perPage);

  const columns = [
    "id",
    "name",
    "item_url",
    "img_average_on_body",
    "img_product_image",
    "img_plus_lifestyle",
    "img_average_crop",
    "brand",
    "material",
    "description",
    "weather",
  ];
  const stringifier = stringify({
    delimiter: ",",
    header: true,
    columns: columns,
  });
  const articlesFile = `${brandDirectory}/articles.csv`;
  const writableStream = fs.createWriteStream(articlesFile);
  stringifier.pipe(writableStream);

  let currentPage = 0;
  while (currentPage < numPages) {
    instance
      .get(
        `https://grdn4zdqxj.execute-api.ap-southeast-2.amazonaws.com/production/fh/category?fh_location=catalog01%2Fen_AU%2Fcategories%3C%7Bcatalog01_287%7D%2Fcategories%3C%7Bcatalog01_287_389%7D&limit=${perPage}&fh_displayfields_mode=live&channel=desktop&page=${
          currentPage + 1
        }`
      )
      .then((response) => {
        return response.data["products"];
      })
      .then((products) => {
        const attributesInDataset = [
          "secondid",
          "name",
          "brand",
          "img_average_on_body",
          "img_product_image",
          "img_plus_lifestyle",
          "brand",
          "img_average_crop",
          "material",
          "description",
          "weather",
          "url_key",
        ];
        products.forEach((product) => {
          const attributes = product["attribute"];
          const reqAttrs = attributes.filter((attr) =>
            attributesInDataset.includes(attr.name)
          );
          const attrsMap = new Map();
          reqAttrs.forEach((attr) => {
            attrsMap.set(attr.name, attr["value"][0]["value"]);
          });
          const row = [
            attrsMap.get("secondid"),
            attrsMap.get("name"),
            attrsMap.get("url_key"),
            attrsMap.get("img_average_on_body"),
            attrsMap.get("img_product_image"),
            attrsMap.get("img_plus_lifestyle"),
            attrsMap.get("img_average_crop"),
            attrsMap.get("brand"),
            attrsMap.get("material"),
            attrsMap.get("description"),
            attrsMap.get("weather"),
          ];
          // setTimeout(
          //   () => fetchProduct(attrsMap.get("secondid"), attrsMap.get("url_key")),
          //   Math.floor(Math.random() * 5000)
          // );
          stringifier.write(row);
        });
      });
    currentPage += 1;
  }
}

function fetchAllArticles() {
  const articlesFile = `${brandDirectory}/articles.csv`;
  const readableStream = fs.createReadStream(articlesFile);

  readableStream
    .pipe(
      csv_parser({
        delimiter: ",",
        from_line: 2,
      })
    )
    .on("data", (data) => {
      if (fs.existsSync(`${articlesDirectory}/${data[0]}.json`)) {
      } else {
        setTimeout(
          () => fetchProduct(data[0], data[2]),
          Math.floor(Math.random() * 5000)
        );
      }
    });
}

function fetchProduct(id, productUrl) {
  instance
    .get(`${baseUrl}${productUrl}`, {
      headers: {
        "User-Agent":
          user_agents[Math.floor(Math.random() * user_agents.length)],
        Referer: "https://www.birdsnest.com.au/",
        Origin: "https://www.birdsnest.com.au",
      },
    })
    .then(function (response) {
      return response.data;
    })
    .then(function (html) {
      var doc = parse(html, "text/html");
      var script = doc
        .getElementsByTagName("script")
        .find((div) =>
          div.rawText?.includes("window.stencilBootstrap")
        )?.rawText;
      const product_json = eval(script);

      try {
        fs.writeFileSync(
          `${articlesDirectory}/${id}.json`,
          JSON.stringify(JSON.parse(product_json))
        );
      } catch (e) {
        console.error(e);
      }
    });
}

function compare() {
  const allIds = [];
  const articlesFile = `${brandDirectory}/articles.csv`;
  const readableStream = fs.createReadStream(articlesFile);

  readableStream
    .pipe(
      csv_parser({
        delimiter: ",",
        from_line: 2,
      })
    )
    .on("data", (data) => {
      allIds.push(data[2]);
    })
    .on("finish", () => {
      const allFiles = [];
      fs.readdir(`${articlesDirectory}`, function (err, files) {
        //handling error
        if (err) {
          return console.log("Unable to scan directory: " + err);
        }
        //listing all files using forEach
        files.forEach(function (file) {
          // Do whatever you want to do with the file
          const fileName = file.split(".json");
          allFiles.push(fileName[0]);
        });

        var set = new Set(allIds);
        console.log(set.size);
        let unique1 = allIds.filter((o) => allFiles.indexOf(o) === -1);
        let unique2 = allFiles.filter((o) => allIds.indexOf(o) === -1);
        const unique = unique1.concat(unique2);

        console.log(allIds.length, allFiles.length);
        console.log(unique);
      });
    });
}

fetchAllArticles();
