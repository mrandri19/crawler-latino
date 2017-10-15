import * as cheerio from "cheerio";
import * as rp from "request-promise-native";
import { writeFile as writeFile_, readdir as readdir_ } from "fs";
import { promisify } from "util";
import { join } from "path";
import * as winston from "winston";

const writeFile = promisify(writeFile_);
const readdir = promisify(readdir_);

function get_next_link($: CheerioStatic) {
  return $("a[href^='/dizionario-latino-italiano.php?browse']")[0].attribs[
    "href"
  ];
}

function get_word_links($: CheerioStatic) {
  return $("a[href^='/dizionario-latino-italiano.php?lemma=']")
    .toArray()
    .map(elem => elem.attribs["href"]);
}

function get_full_url(url: string) {
  return "http://test2.dizionario-latino.com" + url;
}

async function download_and_process_word_page(url: string) {
  // Word relative logging function
  const log: any = (...args: any[]) => winston.info(url.split("=")[1], ...args);

  const filename = url.split("=")[1] + ".html";
  if ((await readdir("./data")).indexOf(filename) > -1) {
    log("Duplicate found, skipping");
    return;
  }

  const res = await rp({
    url: get_full_url(url)
  });
  log("downloaded main word page");

  await writeFile(join("./data", filename), res);
  log("saved main word page");

  const $_main_page = cheerio.load(res);
  const link_elem = $_main_page("#myth > a");
  const link_text = link_elem.text();

  if (link_text == "vedi la declinazione di questo lemma") {
    log("is a declination");
    const declination_link = link_elem[0].attribs["href"];

    const declination_res = await rp({
      url: get_full_url(declination_link)
    });
    log("downloaded declination page");

    await writeFile(
      join("./data", url.split("=")[1]) + "-declination" + ".html",
      declination_res
    );
    log("saved declination page");
  } else if (link_text == "vedi la coniugazione di questo lemma") {
    log("is a verb");
    const conjugation_link = link_elem[0].attribs["href"];

    const conjugation_res = await rp({
      url: get_full_url(conjugation_link)
    });
    log("downloaded conjugation page");

    await writeFile(
      join("./data", url.split("=")[1]) + "-conjugation" + ".html",
      conjugation_res
    );
    log("saved conjugation page");

    const $_verb_page = cheerio.load(conjugation_res);
    const verb_link_elem = $_verb_page("#middle > span.lnk > a");
    if (verb_link_elem.text() == "Vedi la forma passiva di questo lemma") {
      log("passive form found");
      const passive_form_link = verb_link_elem[0].attribs["href"];

      const passive_form_res = await rp({
        url: get_full_url("/" + passive_form_link)
      });
      log("downloaded passive form page");

      await writeFile(
        join("./data", url.split("=")[1]) + "-passive-form" + ".html",
        passive_form_res
      );
      log("saved passive form page");
    }
  }
}

async function crawl() {
  let url =
    "http://test2.dizionario-latino.com/dizionario-latino-italiano.php?browse=A";

  while (true) {
    winston.info(url);
    const page = await rp({ url: url, transform: body => cheerio.load(body) });
    const next_link = get_next_link(page);
    const word_links = get_word_links(page);

    // https://gist.github.com/sibelius/2142604dad92c92e9198380860d12098
    // Maybe limit them instead of 50

    const words = await Promise.all(
      word_links.map(link => download_and_process_word_page(link))
    );
    // await download_and_process_word_page(word_links[2]);
    url = get_full_url(next_link);
  }
}

crawl();
