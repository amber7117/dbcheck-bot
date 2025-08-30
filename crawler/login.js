// crawler/login.js
const axios = require("axios");
const cheerio = require("cheerio");
const qs = require("qs");
const CookieModel = require("../models/cookie");

async function login() {
  try {
    // 1. 获取登录页面
    const resLogin = await axios.get("https://zowner.info/login.php", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
      },
    });

    // 2. 解析 hidden token（如果有）
    const $ = cheerio.load(resLogin.data);
    const csrfToken = $('input[name="token"]').val();

    // 3. 构造登录请求
    const payload = {
      myusername: process.env.ZOWNER_USER || "hayden",
      mypassword: process.env.ZOWNER_PASS || "123456",
    };
    if (csrfToken) payload.token = csrfToken;

    const res = await axios.post(
      "https://zowner.info/login.php",
      qs.stringify(payload),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
          Referer: "https://zowner.info/login.php",
          Origin: "https://zowner.info",
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 500,
      }
    );

    // 4. 提取 cookies
    const setCookies = res.headers["set-cookie"];
    if (!setCookies) throw new Error("❌ Login failed, no cookies returned");

    const cookieStr = setCookies.map((c) => c.split(";")[0]).join("; ");

    // 5. 存入 MongoDB
    await CookieModel.findOneAndUpdate(
      { name: "zowner" },
      { cookies: cookieStr, updatedAt: new Date() },
      { upsert: true }
    );

    console.log("✅ Login success, cookies saved to DB.");
    return cookieStr;
  } catch (err) {
    console.error("❌ Login error:", err.message || err);
    throw err;
  }
}

if (require.main === module) {
  login();
}

module.exports = login;

