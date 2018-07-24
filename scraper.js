
// simple way to make http calls
const request = require("request");
// jquery style functionality
const cheerio = require("cheerio");
// convert json data to csv format
const converter = require("json-2-csv");
// capture the time/date of a scrape
const moment = require("moment");
// file + folder creation
const fs = require("fs");

const errorFunc = function(error) {
  console.log("The scraper had an issue with " + url + ". Either the site is down or your connection is bad.");
  const errorDate = new Date();
  const errorLog = `[${errorDate}] ${error.message}`;

  // write the error log to file
  fs.appendFile("scrape-error.log", errorLog, function(err) {
    if (err) throw err;
    console.log("There was an error. It has been logged to scrape-error.log");
  });
};

const url = "http://shirts4mike.com";
const totalShirts = new Array();
const shirtsToScrape = [];
const linksSeen = [];
const csvHeaders = ["Title", "Price", "ImageURL", "URL", "Time", ];

// promise structure for scrape
const requestPromise = function(url) {
  return new Promise(function(resolve, reject) {
      request(url, function(error, response, html) {

          // if there's an error, send error details
          if(error) return reject(error);

          // if not, send html details
          if(!error && response.statusCode == 200){
              return resolve(html);
          }
      });
  });
}

firstScrape(url)
  .then(getLinks)
  .then(secondScrape)
  .then(thirdScrape)
  .then(writeToFile)
  .catch(function(error) {
    console.log(error);
});

function firstScrape(url) {
  // what to do with first html details
  return requestPromise(url)
  .then(function(html) {
    const $ = cheerio.load(html);
    // find all hrefs with the word shirt
    $("a[href*='shirt']").each(function() {
      const href = $(this).attr("href");
      const fullPath = `${url}/${href}`;
      // add the full path of all links found on the homepage
      if (linksSeen.indexOf(fullPath) === -1) {
        linksSeen.push(fullPath);
      }
    });
    return (linksSeen);
  })
  .catch(function(error) {
    console.log("First scrape failed");
    errorFunc(error)
  });
}

function getLinks(linksSeen) {
  const productPages = [];
  for (let i = 0; i < linksSeen.length; i++) {
    if (linksSeen[i].indexOf("?id=") > 0 ) {
      productPages.push(linksSeen[i]);
    } else {
      shirtsToScrape.push(linksSeen[i]);
    }
    return { productPages: productPages, shirtsToScrape: shirtsToScrape };
  }
}

function secondScrape(filterObj) {
  // assign variables to specific areas of the scrape
  const productPages = filterObj.productPages;
  const shirtsForScrape = filterObj.shirtsToScrape;
  const promiseArray = [];

  for(let j = 0; j < shirtsForScrape.length; j++){
    promiseArray.push(requestPromise(shirtsForScrape[j]));
    var promises = Promise.all(promiseArray);
  }

  return(promises)
    .then(function(promises){
      for (let k = 0; k < promises.length; k++) {
        const $ = cheerio.load(promises[k]);

        $("a[href*='shirt.php?id=']").each(function() {
          const href = $(this).attr("href");
          const fullPath = url + "/" + href;

          if (productPages.indexOf(fullPath) === -1) {
            productPages.push(fullPath);
          }

        }); // Ends each loop
      } // End For
      return productPages;
    })
    .catch(function(error){
      console.log("Second scrape failed");
      errorFunc(error);
    });
}

function thirdScrape(productPages) {
  const promiseArray = [];

  for (var l = 0; l < productPages.length; l++) {
      promiseArray.push(requestPromise(productPages[l]));
      var promises = Promise.all(promiseArray);
  }

  return(promises)
    .then(function(promises) {
      for (var m = 0; m < promises.length; m++) {
        var $ = cheerio.load(promises[m]),
            title = $("title").text(),
            price = $(".price").text(),
            img = $(".shirt-picture img").attr("src"),
            shirts = {}; // Create empty JSON object with shirt data
        shirts.Title = title;
        shirts.Price = price;
        shirts.ImageURL = url + img; // Log full path URL
        shirts.URL = productPages[m];
        shirts.Time = moment().format("MMMM Do YYYY, h:mm:ss a");
        totalShirts.push(shirts);
      }
      return totalShirts;
    })
    .catch(function(error){
      Console.log("Third scrape failed")
      errorFunc(error)
    });
}

function writeToFile(shirtsData){
  // Create data folder if it doesn't exist
  if (!fs.existsSync("./data")) {
    fs.mkdirSync("./data");
  }
  // Use json-2-csv module to convert JSON
  converter.json2csv(shirtsData, function(error, csv) {
    if (error) {
      console.log("Error at the file writing step");
      errorFunc(error);
    } else {
      console.log("Writing to csv file.");
      // create filename by appending .csv to the current date
      var newcsvname = "./data/" + scraperDate() + ".csv";
      fs.writeFile(newcsvname, csv, function(error) {
        if (error) {
          errorFunc(error);
        }
      });
    }
  });
}

function scraperDate() {
  // get new date object
  const d = new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1);
  const day = d.getDate();

  return [year, month, day].join('-');
} // ends scraperDate
