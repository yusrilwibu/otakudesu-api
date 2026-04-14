const https = require("https");

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,*/*",
        "Accept-Language": "id-ID,id;q=0.9",
        "Referer": "https://otakudesu.cloud/",
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => resolve(d));
    });
    req.on("error", reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function parseCards(html) {
  const items = [];
  const re = /href="https:\/\/otakudesu\.cloud\/anime\/([^\/]+)\/"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<h2[^>]*>([^<]+)<\/h2>[\s\S]*?(?:class="[^"]*epz[^"]*"[^>]*>([^<]*)<\/div>)?/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    items.push({ animeId: m[1], poster: m[2], title: m[3].trim(), episodes: m[4] ? m[4].trim() : null });
  }
  return items;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  const path = (req.url || "/").split("?")[0];
  const qs = req.url && req.url.includes("?") ? Object.fromEntries(new URLSearchParams(req.url.split("?")[1])) : {};
  const page = qs.page || "1";
  try {
    let data = {};
    if (path.includes("/ongoing")) {
      const html = await fetch("https://otakudesu.cloud/ongoing-anime/page/" + page + "/");
      data = { animeList: parseCards(html) };
    } else if (path.includes("/complete") || path.includes("/completed")) {
      const html = await fetch("https://otakudesu.cloud/complete-anime/page/" + page + "/");
      data = { animeList: parseCards(html) };
    } else if (path.includes("/search")) {
      const html = await fetch("https://otakudesu.cloud/?s=" + encodeURIComponent(qs.q || "") + "&post_type=anime");
      data = { animeList: parseCards(html) };
    } else if (path.includes("/home")) {
      const html = await fetch("https://otakudesu.cloud/");
      data = { animeList: parseCards(html).slice(0, 20) };
    } else if (path.match(/\/anime\/([^\/\?]+)/)) {
      const id = path.match(/\/anime\/([^\/\?]+)/)[1];
      const html = await fetch("https://otakudesu.cloud/anime/" + id + "/");
      const tM = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/h1>/);
      const pM = html.match(/class="[^"]*fotoanime[^"]*"[\s\S]*?<img[^>]+src="([^"]+)"/);
      const sM = html.match(/class="[^"]*sinopc[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      const eRe = /href="https:\/\/otakudesu\.cloud\/episode\/([^\/]+)\/"[^>]*>\s*Episode\s+(\d+)/gi;
      const eps = []; let em;
      while ((em = eRe.exec(html)) !== null) eps.push({ episodeId: em[1], episodeNum: em[2] });
      data = { info: { title: tM ? tM[1].trim() : id, poster: pM ? pM[1] : "", synopsis: sM ? sM[1].replace(/<[^>]+>/g, "").trim() : "", totalEpisodes: eps.length.toString() }, episodeList: eps.reverse() };
    } else if (path.match(/\/episode\/([^\/\?]+)/)) {
      const id = path.match(/\/episode\/([^\/\?]+)/)[1];
      const html = await fetch("https://otakudesu.cloud/episode/" + id + "/");
      const tM = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/h1>/);
      const vRe = /data-video="([^"]+)"/gi;
      const servers = []; let vm;
      while ((vm = vRe.exec(html)) !== null) {
        let u = vm[1];
        if (u.startsWith("//")) u = "https:" + u;
        if (u.startsWith("/")) u = "https://otakudesu.cloud" + u;
        servers.push({ serverName: "Server " + (servers.length + 1), qualities: [{ quality: "SD", url: u }] });
      }
      const pM = html.match(/href="https:\/\/otakudesu\.cloud\/episode\/([^\/]+)\/"[^>]*>[^<]*(?:Prev|laquo)/i);
      const nM = html.match(/href="https:\/\/otakudesu\.cloud\/episode\/([^\/]+)\/"[^>]*>[^<]*(?:Next|raquo)/i);
      data = { title: tM ? tM[1].trim() : id, streamingLink: servers, prevEpisode: pM ? pM[1] : null, nextEpisode: nM ? nM[1] : null };
    } else if (path.includes("/schedule")) {
      const html = await fetch("https://otakudesu.cloud/jadwal-rilis/");
      const result = {};
      for (const day of ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"]) {
        const sRe = new RegExp("<h2[^>]*>" + day + "<\\/h2>([\\s\\S]*?)(?=<h2|$)", "i");
        const sec = html.match(sRe);
        if (sec) {
          const aRe = /href="https:\/\/otakudesu\.cloud\/anime\/([^\/]+)\/"[^>]*>([^<]+)<\/a>/gi;
          const animes = []; let am;
          while ((am = aRe.exec(sec[1])) !== null) animes.push({ animeId: am[1], title: am[2].trim(), poster: "" });
          if (animes.length) result[day.toLowerCase()] = animes;
        }
      }
      data = result;
    } else if (path.includes("/genre")) {
      const html = await fetch("https://otakudesu.cloud/genre-list/");
      const gRe = /href="https:\/\/otakudesu\.cloud\/genres\/([^\/]+)\/"[^>]*>([^<]+)<\/a>/gi;
      const genres = []; let gm;
      while ((gm = gRe.exec(html)) !== null) genres.push({ genreId: gm[1], name: gm[2].trim() });
      data = { genreList: genres };
    } else {
      data = { message: "Otakudesu API", routes: ["/ongoing","/completed","/search?q=","/home","/anime/:id","/episode/:id","/schedule","/genre"] };
    }
    res.statusCode = 200;
    res.end(JSON.stringify({ statusCode: 200, statusMessage: "OK", data }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ statusCode: 500, error: err.message }));
  }
};
