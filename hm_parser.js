import { parse } from "node-html-parser";
import { parse as csv_parser } from "csv-parse";
import fs from "fs";
import { stringify } from "csv-stringify";
import axios from "axios";
import { AxiosError } from "axios";

const brandDirectory = "hm";
const genderDirectory = `${brandDirectory}/women`;
const articlesDirectory = `${genderDirectory}/articles`;
/**
 * Change this URL to gender view all url.
 */
const viewAll = "https://www2.hm.com/en_in/men/shop-by-product/view-all.html";

try {
  fs.mkdirSync(articlesDirectory, { recursive: true });
} catch (e) {
  if (e.code != "EEXIST") throw e;
}

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

function fetchAllUrls() {
  instance
    .get(viewAll)
    .then(function (response) {
      // The API call was successful!
      return response.data;
    })
    .then((html) => {
      var doc = parse(html, "text/html");
      var data_total = doc
        .getElementsByTagName("h2")
        .find((h2) => h2.rawAttributes.class.includes("load-more-heading"));
      return data_total.attributes["data-total"];
    })
    .then(async (total) => {
      const columns = ["id", "category", "item_url"];
      const stringifier = stringify({
        delimiter: ",",
        header: true,
        columns: columns,
      });
      const articlesFile = `${genderDirectory}/articles.csv`;
      const writableStream = fs.createWriteStream(articlesFile);
      stringifier.pipe(writableStream);

      var offset = 0;
      var pageSize = 100;
      while (offset < total) {
        const all = `${viewAll}?offset=${offset}&page-size=${pageSize}`;
        const response = await instance.get(all);
        const html = response.data;
        console.log(response.status);

        var doc = parse(html, "text/html");
        const articleNodes = doc
          .getElementsByTagName("article")
          .filter((article) =>
            article.attributes.class.includes("hm-product-item")
          )
          .map((article) => {
            return article.childNodes.find((node) =>
              node?.attributes?.class.includes("image-container")
            );
          });

        const data = articleNodes.map((article) => {
          const aTag = article.childNodes.find(
            (node) => node.rawTagName === "a"
          );
          return [
            article.parentNode.attributes["data-articlecode"],
            article.parentNode.attributes["data-category"],
            aTag.attributes["href"],
          ];
        });

        data.forEach((row) => stringifier.write(row));
        offset += pageSize;
      }
    });
}

function fetchAllArticles() {
  const articlesFile = `${genderDirectory}/articles.csv`;
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
        setTimeout(() => crawlArticle(data), Math.floor(Math.random() * 5000));
      }
    });
}

function crawlArticle(article) {
  const isDesktop = true;

  instance
    .get(`https://www2.hm.com${article[2]}`, {
      headers: {
        "User-Agent":
          user_agents[Math.floor(Math.random() * user_agents.length)],
      },
    })
    .then(function (response) {
      return response.data;
    })
    .then(function (html) {
      var doc = parse(html, "text/html");

      const window = {
        innerWidth: 1080,
      };
      var script = doc
        .getElementsByTagName("div")
        .find((div) => div.attributes?.class?.includes("product parbase"))
        .childNodes[3]?.rawText;

      var productAvailabilityUrl = "";
      const hm = {
        options: {
          product: {
            productAvailabilityServiceUrl: "",
          },
          pdpAccordion: "",
        },
      };

      hm.i18n = {
        sustainability: {
          starterButton: "",
          modalTitle: "",
        },
      };
      const productArticleDetails = eval(script + "; productArticleDetails;");
      fs.writeFileSync(
        `${articlesDirectory}/${article[0]}.json`,
        JSON.stringify(productArticleDetails)
      );
    })
    .catch(function (err) {
      // There was an error
      if (err instanceof AxiosError) {
        console.log(err.code, data[0]);
      }
    });
}
///
fetchAllUrls();
fetchAllArticles();

// const allIds = [];
// const articlesFile = `${genderDirectory}/articles.csv`;
// const readableStream = fs.createReadStream(articlesFile);

// readableStream
//   .pipe(
//     csv_parser({
//       delimiter: ",",
//       from_line: 2,
//     })
//   )
//   .on("data", (data) => {
//     allIds.push(data[0]);
//   })
//   .on("finish", () => {
//     const allFiles = [];
//     fs.readdir(`${articlesDirectory}`, function (err, files) {
//       //handling error
//       if (err) {
//         return console.log("Unable to scan directory: " + err);
//       }
//       //listing all files using forEach
//       files.forEach(function (file) {
//         // Do whatever you want to do with the file
//         const fileName = file.split(".json");
//         allFiles.push(fileName[0]);
//       });

//       var set = new Set(allIds);
//       console.log(set.size);
//       let unique1 = allIds.filter((o) => allFiles.indexOf(o) === -1);
//       let unique2 = allFiles.filter((o) => allIds.indexOf(o) === -1);
//       const unique = unique1.concat(unique2);

//       console.log(allIds.length, allFiles.length);
//       console.log(unique);
//     });
//   });
