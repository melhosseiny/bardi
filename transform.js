import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

export function Transform(spec) {
  let imgNode = function(node, loading, host = '') {
    // console.log(`imgNode`, node)
    node._type = 'html_block';
    node.literal = '<figure><picture><source srcset="' + host + '/' + node.destination + '"><img ' + (loading === 'lazy' ? ' loading="lazy"' : '') + ' src="' + host + '/' + node.destination + '" alt=""></picture></figure>';
    node.destination = null;
    node._parent._type = 'document';
    return node;
  }

  let imgInHtmlBlock = function(node, loading, host = '') {
    let parser = new DOMParser();
    let doc = parser.parseFromString(node.literal, 'text/html');
    let imgs = doc.querySelectorAll('img');
    [...imgs].map(img => {
      // console.log(`imginHtmlBlock`, node, img);
      let absPath = new URL(img.getAttribute("src"), host).href;
      if (loading === 'lazy') {
        img.setAttribute('loading', loading);
      }
      img.setAttribute('src', absPath);

      let picture = doc.createElement('picture');
      let source = doc.createElement('source');
      // source.setAttribute('type','image/png');
      source.setAttribute('srcset', absPath);
      picture.appendChild(source);
      img.parentNode.insertBefore(picture, img);
      picture.appendChild(img);

    })
    let serializedDom = doc.body.children[0].outerHTML;
    console.log(serializedDom);
    node.literal = serializedDom;
    return node;
  }

  let videoInHtmlBlock = function(node, loading, host = '') {
    let parser = new DOMParser();
    let doc = parser.parseFromString(node.literal, 'text/html');
    let sources = doc.querySelectorAll('video source');
    console.log('videos', sources);

    [...sources].map(source => {
      let absPath = new URL(source.getAttribute("src"), host).href;
      source.setAttribute("src", absPath);

      
      let serializedDom = doc.body.children[0].outerHTML;
      console.log(serializedDom);
      node.literal = serializedDom;
      return node;
    })

    return node;
  }

  return Object.freeze({
    imgNode,
    imgInHtmlBlock,
    videoInHtmlBlock
  });
}
