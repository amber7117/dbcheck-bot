const axios = require("axios");
const tough = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const cheerio = require("cheerio");
const Cookie = require("../models/cookie");

async function search(queryText) {
  const dbCookies = await Cookie.findOne({ name: "zowner" });
  if (!dbCookies) throw new Error("⚠️ Please login first");

  const jar = new tough.CookieJar();
  // restore cookies from DB
  for (const c of dbCookies.cookies) {
    jar.setCookieSync(
      new tough.Cookie({
        key: c.key || c.name,
        value: c.value,
        domain: c.domain.replace(/^\./, ""),
        httpOnly: c.httpOnly,
        secure: c.secure,
        path: c.path || "/",
      }),
      "https://zowner.info"
    );
  }

  const client = wrapper(axios.create({ jar }));

  // 1. Load search page
  const searchPage = await client.get("https://zowner.info/index.php", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const $ = cheerio.load(searchPage.data);
  const formData = {
    keyword: queryText,
    category: 3,
  };

  // detect category automatically
  if (/^\d{12,18}$/.test(queryText)) formData.category = 1;
  else if (/^\d{11}$/.test(queryText)) formData.category = 4;

  // if there are hidden inputs, include them
  $("form input[type=hidden]").each((i, el) => {
    const name = $(el).attr("name");
    const value = $(el).attr("value") || "";
    if (name) formData[name] = value;
  });

  // 2. Submit search form
  const res = await client.post(
    "https://zowner.info/index.php",
    new URLSearchParams(formData).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        Referer: "https://zowner.info/index.php",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    }
  );

  if (res.status !== 200) {
    throw new Error(`❌ Search failed, status ${res.status}`);
  }

  // 3. Parse results
  const $$ = cheerio.load(res.data);
  const rows = [];
  $$("#dataTable tbody tr").each((i, el) => {
    const cols = $$(el).find("td");
    if (cols.length >= 5) {
      rows.push({
        idCard: $$(cols[0]).text().trim(),
        name: $$(cols[1]).text().trim(),
        oldId: $$(cols[2]).text().trim(),
        address: $$(cols[3]).text().trim(),
        phone: $$(cols[4]).text().trim(),
      });
    }
  });

  return rows;
}

module.exports = search;

