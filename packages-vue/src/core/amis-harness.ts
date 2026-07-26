/**
 * 生成预览 iframe 的 srcdoc 内容。
 * 内部加载 amis SDK（CDN UMD），监听来自编辑器的 render 消息并渲染 schema。
 * 为避免模板字符串嵌套冲突，内部脚本使用字符串拼接而非反引号。
 */
export function buildHarnessSrcDoc(amisVersion: string): string {
  const base = `https://cdn.jsdelivr.net/npm/amis@${amisVersion}/sdk`;
  return [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>',
    '<link rel="stylesheet" href="' + base + '/sdk.css"/>',
    '<link rel="stylesheet" href="' + base + '/helper.css"/>',
    '<link rel="stylesheet" href="' + base + '/icons.css"/>',
    '<style>html,body{margin:0;padding:0;height:100%;}',
    '#root{min-height:100%;}',
    '.ae-render-error{padding:16px;color:#f56c6c;font-family:monospace;}',
    '</style>',
    '</head>',
    '<body>',
    '<div id="root"></div>',
    '<script src="' + base + '/sdk.js"></script>',
    '<script>',
    '(function(){',
    '  var root = document.getElementById("root");',
    '  var scoped = null;',
    '  var doEmbed = null;',
    '  var pending = [];',
    '  function renderSchema(schema){',
    '    try{',
    '      if(scoped && scoped.unmount){ scoped.unmount(); }',
    '      root.innerHTML = "";',
    '      scoped = doEmbed(root, schema, { data: {} });',
    '    }catch(e){',
    '      root.innerHTML = "<div class=\\"ae-render-error\\">渲染错误: " + (e && e.message ? e.message : e) + "</div>";',
    '    }',
    '  }',
    '  window.addEventListener("message", function(ev){',
    '    var d = ev.data;',
    '    if(!d || d.source !== "amis-editor-vue"){ return; }',
    '    if(d.type === "render"){',
    '      if(doEmbed){ renderSchema(d.schema); } else { pending.push(d.schema); }',
    '    }',
    '  });',
    '  amis.require(["amis/embed"], function(embed){',
    '    doEmbed = embed.embed;',
    '    parent.postMessage({ source: "amis-preview", type: "ready" }, "*");',
    '    while(pending.length){ renderSchema(pending.shift()); }',
    '  });',
    '})();',
    '</script>',
    '</body>',
    '</html>'
  ].join('\n');
}
