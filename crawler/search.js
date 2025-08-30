const axios = require("axios");
const tough = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const cheerio = require("cheerio");
const Cookie = require("../models/cookie");
const login = require("./login");

async function getClient() {
  const jar = new tough.CookieJar();
  const client = wrapper(axios.create({ jar }));

  const record = await Cookie.findOne({ name: "zowner" });
  if (!record) {
    console.log("⚠️ No cookies, logging in...");
    return await login();
  }

  // 载入数据库里的 cookies
  for (const c of record.cookies) {
    jar.setCookieSync(`${c.key}=${c.value}`, "https://zowner.info");
  }

  // 测试 cookies 是否还有效
  const res = await client.get("https://zowner.info/index.php");
  if (res.request.res.responseUrl.includes("login.php")) {
    console.log("⚠️ Cookies expired, re-login...");
    return await login();
  }

  return client;
}

async function search(queryText) {
  const client = await getClient();

  // 判断查询类型
  let category = 3; // 默认 name
  if (/^\d{12,18}$/.test(queryText)) category = 1; // IC
  else if (/^\d{11}$/.test(queryText)) category = 4; // Phone

  // 发 POST 请求到 list.php
  const res = await client.post(
    "https://zowner.info/list.php",
    new URLSearchParams({
      keyword: queryText,
      category,
      button: "Buy Now"
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  const $ = cheerio.load(res.data);
  const results = [];
  const seen = new Set();

  $("#dataTable tbody tr").each((i, el) => {
    const cols = $(el).find("td");
    if (cols.length >= 5) {
      const idCard = $(cols[0]).text().trim();
      const name = $(cols[1]).text().trim();
      const oldId = $(cols[2]).text().trim();
      const address = $(cols[3]).text().trim();
      const phone = $(cols[4]).text().trim();

      const finalId = idCard && idCard !== "NULL" ? idCard : oldId && oldId !== "NULL" ? oldId : "";
      if (!finalId || !phone) return;

      const key = `${finalId}-${phone}`;
      if (seen.has(key)) return;
      seen.add(key);

      results.push({
        name: name || "Unknown",
        idCard: finalId,
        phone: phone,
        address: address || "Unknown",
      });
    }
  });

  return results;
}

module.exports = search;

