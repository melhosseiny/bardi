/**
 * Content management system for warm-dawn
 *
 * @module
 */

import "https://unpkg.com/commonmark@0.30.0/dist/commonmark.js";
import { Transform } from "./transform.js";
import { renderMath } from "./auto-render.js";

const { ASSET_HOST } = JSON.parse(await Deno.readTextFile("bardi.json"));

const reader = new commonmark.Parser();
const writer = new commonmark.HtmlRenderer();
const transform = Transform();

let index = [];

const parse_markdown = function(markdown) {
  let parsed = reader.parse(markdown);
  var walker = parsed.walker();
  let event, node;
  let name, tags, img;
  let imgCount = 0;

  while ((event = walker.next())) {
    node = event.node;

    if (event.entering) {
      // console.log('imgCount', imgCount);
      const loading = imgCount > 0 ? "lazy" : "auto";
      switch (node.type) {
        case "heading":
          if (name === undefined) {
            name = node._firstChild.literal;
            console.log(node.type, node._firstChild.literal);
          }
          break;
        case "html_inline":
          if (node.literal === "<wd-tags>") {
            tags = node.next.literal.split(' ').map(tag => tag.substring(1));
            console.log(tags);
          }
          console.log(node.type, node.literal);
          break;
        case 'html_block':
          if (node._htmlBlockType !== 2) {
            if (node.literal.indexOf('img') !== -1) {
              transform.imgInHtmlBlock(node, loading, ASSET_HOST);
              if (imgCount === 0) {
                console.log('image', node.literal);
                const src_index = node.literal.indexOf("src=");
                const alt_index = node.literal.indexOf("\" alt");
                img = node.literal.substring(src_index + 5, alt_index);
              }
            } else if (node.literal.indexOf('video') !== -1) {
              transform.videoInHtmlBlock(node, loading, ASSET_HOST);
            }
            imgCount++;
          }
          break;
        case 'image':
          transform.imgNode(node, loading, ASSET_HOST);
          if (imgCount === 0) {
            console.log('image', node.literal);
            const src_index = node.literal.indexOf("src=");
            const alt_index = node.literal.indexOf("\" alt");
            img = node.literal.substring(src_index + 5, alt_index);
          }
          imgCount++;
          break;
      }
    }
  }

  return [parsed, name, img, tags];
}

const find_note_in_index_by_id = async (slug) => {
  const index = JSON.parse(await Deno.readTextFile("index.json"));
  const note_meta = index.find(note => note.id === slug);
  const note_index = index.findIndex(note => note.id === slug);
  return [note_meta, note_index];
}

const compile_note = async (slug, text) => {
  const [parsed, name, img, tags] = parse_markdown(text);
  const rendered = writer.render(parsed);
  const html = tags && tags.includes("math") ? renderMath(rendered) : rendered;
  await Deno.writeTextFile(`${slug}.html`, html);
}


/**
 * Indexes a new note or reindexes an existing one.
 *
 * Does not sort after indexing, so `index.json` needs to be sorted using `bardi sort`.
 *
 * @param slug note id
 * @param text note md content
 */
async function index_note(slug, text) {
  const [parsed, name, img, tags] = parse_markdown(text);
  const rendered = writer.render(parsed);
  const html = tags.includes("math") ? renderMath(rendered) : rendered;
  await Deno.writeTextFile(`${slug}.html`, html);

  index = JSON.parse(Deno.readTextFileSync("index.json"));
  const note_index = index.findIndex(note => note.id === slug);

  const note = {
    id: slug,
    name,
    img,
    time: new Date(),
    tags
  }
  console.log(note);
  if (note_index === -1) {
    index.push(note);
  } else {
    index[note_index] = note; // re index if exists
  }
  Deno.writeTextFileSync("index.json", JSON.stringify(index));
}

const remove_notes = () => {
  for (const entry of Deno.readDirSync('.')) {
    if (entry.name.endsWith(".md") || entry.name.endsWith(".html")) {
      //console.log(entry);
      Deno.removeSync(`./${entry.name}`);
    }
  }
}

const main = async () => {
  console.log(Deno.args);
  
  const [command, target] = [Deno.args[0], Deno.args[1]];
  const slug = target ? target.endsWith(".md") ? target.replace(".md", '') : target : undefined;
  
  switch (command) {
    // index note-23.md
    case "index":
      const content = await Deno.readTextFile(target);
      index_note(slug, content);
      break;
    // compile note-23.md
    case "compile":
      const content_ = await Deno.readTextFile(target);
      compile_note(slug, content_);
      break;
    // remove note-27.md
    case "remove":
      index = JSON.parse(await Deno.readTextFile("index.json"));
      let [note_meta, note_index] = await find_note_in_index_by_id(slug);
      index.splice(note_index, 1);
      await Deno.remove(`./${slug}.md`);
      await Deno.remove(`./${slug}.html`);
      await Deno.writeTextFile("index.json", JSON.stringify(index));
      break;
    // sort
    case "sort":
      index = JSON.parse(await Deno.readTextFile("index.json"));
      index.sort((a, b) => new Date(b.time) - new Date(a.time));
      await Deno.writeTextFile("index.json", JSON.stringify(index));
  }
}

if (import.meta.main) {
  main();
}
