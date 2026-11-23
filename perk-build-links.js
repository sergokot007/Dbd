(function(){
  const key = value => String(value || "").toLowerCase().normalize("NFKD").replace(/[’']/g,"'").replace(/[^a-z0-9]/g,"");
  const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
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
    const names = [label,catalogPerk && catalogPerk.name,catalogPerk && catalogPerk.displayName,catalogPerk && catalogPerk.display_name,catalogPerk && catalogPerk.nameEn,catalogPerk && catalogPerk.englishName,catalogPerk && catalogPerk.id].filter(Boolean).map(key);
    // Restore the original in-game perk artwork in the detail header.
    const perkImage = catalogPerk && (catalogPerk.image || catalogPerk.imageUrl || catalogPerk.image_url || catalogPerk.icon || catalogPerk.iconUrl || catalogPerk.icon_url || catalogPerk.iconURL || catalogPerk.perkIcon || catalogPerk.perk_icon || catalogPerk.iconPath || catalogPerk.icon_path);
    if (perkImage) {
      const head = panel.querySelector(".detail-head");
      const oldImage = head && head.querySelector(":scope > img");
      const placeholder = head && head.querySelector(":scope > .detail-placeholder");
      if (oldImage) {
        oldImage.src = perkImage;
        oldImage.alt = "Иконка перка " + label;
        oldImage.classList.add("perk-original-artwork");
        oldImage.style.objectFit = "contain";
        oldImage.style.background = "rgba(0,0,0,.22)";
      } else if (placeholder) {
        const img = document.createElement("img");
        img.src = perkImage;
        img.alt = "Иконка перка " + label;
        img.className = "perk-original-artwork";
        img.style.objectFit = "contain";
        img.style.background = "rgba(0,0,0,.22)";
        placeholder.replaceWith(img);
      }
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