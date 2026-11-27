(function(){
  "use strict";
  const key = value => typeof window.dbdNormalizeName === "function" ? window.dbdNormalizeName(value) : String(value || "").toLowerCase().normalize("NFKD").replace(/[’']/g, "'").replace(/[^a-z0-9]/g, "");
  const canonicalPerk = value => typeof window.dbdRecordEnglish === "function" ? window.dbdRecordEnglish(value, "perk") : String(value || "");
  const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const original = window.openLoadoutInfo;
  if (typeof original !== "function") return;
  window.openLoadoutInfo = async function(type,label){
    await original.apply(this,arguments);
    if(type !== "perk") return;
    const modal = document.getElementById("loadoutInfoModal");
    const panel = modal && modal.querySelector(".info-panel");
    if(!panel) return;
    const perkList = typeof allPerks !== "undefined" && Array.isArray(allPerks) ? allPerks : [];
    const catalogPerk = perkList.find(p =>
      [p.name,p.displayName,p.display_name,p.nameEn,p.englishName,p.id].some(v=>key(v)===key(label))
    );
    const names = [canonicalPerk(label),label,catalogPerk && catalogPerk.name,catalogPerk && catalogPerk.displayName,catalogPerk && catalogPerk.display_name,catalogPerk && catalogPerk.nameEn,catalogPerk && catalogPerk.englishName,catalogPerk && catalogPerk.id].filter(Boolean).map(key);
    // Restore the original in-game perk artwork in the detail header.
    const perkImage = catalogPerk && (catalogPerk.image || catalogPerk.imageUrl || catalogPerk.image_url || catalogPerk.icon || catalogPerk.iconUrl || catalogPerk.icon_url || catalogPerk.iconURL || catalogPerk.perkIcon || catalogPerk.perk_icon || catalogPerk.iconPath || catalogPerk.icon_path);
    if (perkImage && typeof window.picture === "function") {
      const head = panel.querySelector(".detail-head");
      const oldImage = head && head.querySelector(":scope > img");
      const placeholder = head && head.querySelector(":scope > .detail-placeholder, :scope > .picture-fallback");
      const artwork = window.picture(perkImage,{className:'detail-portrait-art perk-original-artwork',alt:'Иконка перка '+label,eager:true,fallback:'./assets/ui/asset-fallback.webp'});
      if (oldImage) oldImage.outerHTML = artwork;
      else if (placeholder) placeholder.outerHTML = artwork;
    }
    const includes = list => list.some(p=>names.includes(key(p)) || names.some(n=>n && (n.includes(key(p)) || key(p).includes(n))));
    const rows = [];
    const add = (list,role) => (list || []).forEach(build=>{
      if(includes(build.perks || [])) rows.push({title:build.title,role:role,goal:build.goal || build.desc || ""});
    });
    if(typeof survivorBuilds !== "undefined") add(survivorBuilds,"Выживший");
    if(typeof killerBuilds !== "undefined") add(killerBuilds,"Убийца");
    if(typeof UNIVERSAL_BUILDS !== "undefined") add(UNIVERSAL_BUILDS,"Универсальный билд");
    const section = document.createElement("section");
    section.className = "perk-build-usage";
    section.innerHTML = '<div class="eyebrow">BUILD SYNERGY</div><h3>Билды с этим перком</h3>' +
      (rows.length
        ? '<div class="perk-build-usage-list">' + rows.map(row =>
            '<article class="perk-build-usage-card"><b>'+esc(row.title)+'</b><span>'+esc(row.role)+'</span>'+(row.goal?'<p>'+esc(row.goal)+'</p>':'')+'</article>'
          ).join("") + '</div>'
        : '<p class="perk-build-usage-empty">В текущем наборе рекомендаций этот перк пока не используется. Это не означает, что он слабый: можно добавить его в пользовательскую сборку.</p>');
    panel.appendChild(section);
  };
})();
