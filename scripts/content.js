let boxNode;

function createBoxNode(boxed) {
    let div = document.createElement("div");
    div.classList.add("swi-block");
    if (boxed) {
        div.classList.add("swi-boxed");
    }
    return div;
}

function getIconHTML(color, str, lcs, icon, link, extraIcon = "") {
    // eslint-disable-next-line camelcase
    const { name, version, author } = chrome.runtime.getManifest();
    const titlePlus = `\nLast updated at ${lcs}\n${name} (${version}) by ${author}`;
    if (link) {
        return `<span title="${str}\n${titlePlus}"><a style="color: ${color} !important;" href="${link}" target="_blank"><i class="fa-solid fa-${icon}"></i>${extraIcon}</a></span>`;
    }

    return `<span style="color: ${color} !important;" title="${str} on Steam\n${titlePlus}"><i class="fa-solid fa-${icon}"></i>${extraIcon}</span>`;
}

function convertToRGB(color) {
    const aRgbHex = color.replace("#", "").match(/.{1,2}/g);
    const aRgb = [
        parseInt(aRgbHex[0], 16),
        parseInt(aRgbHex[1], 16),
        parseInt(aRgbHex[2], 16),
    ];
    return aRgb;
}

function calculateColor(iconsEncoding, boxOpacity = 0.7) {
    const color = (iconsEncoding * 305040).toString(16);
    const rgb = convertToRGB(color);
    return `rgba(${rgb.join(", ")}, ${boxOpacity})`;
}

function getBoxNode(html, iconsEncoding, appID, subID, boxDynamicColor) {
    const node = boxNode.cloneNode(false);
    if (subID) {
        node.dataset.subid = subID;
    } else if (appID) {
        node.dataset.appid = appID;
    }
    if (boxDynamicColor) {
        node.style.background = `${calculateColor(iconsEncoding)} !important`;
    }
    node.innerHTML = html;
    return node;
}

function doApp(settings, elem, wishlist, ownedApps, ignoredApps, followedApps, decommissioned, limited, cards, bundles, dlc, lcs, dlcs, dlclcs, llcs, clcs, blcs) {
    elem.classList.add("swi");

    /* Example detectable links:
     * https://barter.vg/steam/app/440/
     * https://s.team/a/440/
     * https://steamcdn-a.akamaihd.net/steam/apps/440/header.jpg
     * https://steamdb.info/app/440/
     * https://store.steampowered.com/app/440/
     */

    const attr = settings.attributes.find((a) => /\/a(pps?)?\/[0-9]+/g.test(elem.getAttribute(a)));
    if (!attr) {
        return;
    }

    const attrVal = elem.getAttribute(attr);
    const appID = Number(attrVal.match(/\/a(?:pps?)?\/[0-9]+/g)[0].split(/\/a(?:pps?)?\//)[1]);
    if (Number.isNaN(appID)) {
        return;
    }

    setTimeout(() => { // avoids having the page hang when loading, because it is waiting on our script execution
        let html;
        let subject;
        let iconsEncoding = 0;
        if (dlc && dlc[appID]) {
            subject = "DLC";
        } else if (dlc && !dlc[appID]) {
            subject = "Game";
        } else {
            subject = "Game or DLC";
        }

        if (ownedApps && ownedApps[appID]) { // if owned
            html = getIconHTML(settings.ownedColor, `${subject} (${appID}) owned`, lcs, settings.ownedIcon);
            iconsEncoding += 1;
        } else if (wishlist[appID]) { // if not owned and wishlisted
            html = getIconHTML(settings.wishlistColor, `${subject} (${appID}) wishlisted`, lcs, settings.wishlistIcon);
            iconsEncoding += 3;
        } else { // else not owned and not wishlisted
            html = getIconHTML(settings.unownedColor, `${subject} (${appID}) not owned`, lcs, settings.unownedIcon);
            iconsEncoding += 2;
        }

        if (settings.wantFollowed && followedApps && followedApps[appID]) {
            html += getIconHTML(settings.followedColor, `${subject} (${appID}) followed`, lcs, settings.followedIcon);
            iconsEncoding += 4;
        }

        if (settings.wantIgnores && ignoredApps && ignoredApps[appID]) { // if ignored and enabled
            html += getIconHTML(settings.ignoredColor, `${subject} (${appID}) ignored`, llcs, settings.ignoredIcon);
            iconsEncoding += 5;
        }

        if (settings.wantDLC && dlc && dlc[appID]) { // if DLC and enabled
            const base = dlc[appID].base_appID;
            const ownsBase = Boolean(ownedApps[base]);
            const extraIcon = `<span style="color: ${ownsBase ? settings.ownedColor : settings.unownedColor}; font-weight: bold; font-size: 66%; position: absolute; margin: -4% 0% 0% -4%;">${ownsBase ? "<i class=\"fa-solid fa-plus\"></i>" : "<i class=\"fa-solid fa-minus\"></i>"}</span>&nbsp;`;
            html += getIconHTML(settings.dlcColor, `${subject} (${appID}) is downloadable content for an ${ownsBase ? "" : "un"}owned base game (${base})`, dlclcs, settings.dlcIcon, undefined, extraIcon);
            iconsEncoding += 6;
        }

        if (settings.wantDecommissioned && decommissioned && decommissioned[appID]) { // if decommissioned and enabled
            const app = decommissioned[appID];
            html += getIconHTML(settings.decommissionedColor, `The ${app.type} '${app.name.replace(/"|'/g, "")}' (${appID}) is ${app.category.toLowerCase()} and has only ${app.count} confirmed owner${app.count === 1 ? "" : "s"} on Steam`, dlcs, settings.decommissionedIcon, `https://steam-tracker.com/app/${appID}/`);
            iconsEncoding += 7;
        }

        if (settings.wantLimited && limited && limited[appID]) { // if limited and enabled
            html += getIconHTML(settings.limitedColor, `Game (${appID}) has profile features limited`, llcs, settings.limitedIcon);
            iconsEncoding += 8;
        }

        if (settings.wantCards && cards && cards[appID] && cards[appID].cards && cards[appID].cards > 0) { // if has cards and enabled
            html += getIconHTML(settings.cardColor, `Game (${appID}) has ${cards[appID].cards} ${cards[appID].marketable ? "" : "un"}marketable card${cards[appID].cards === 1 ? "" : "s"}`, clcs, settings.cardIcon, `https://www.steamcardexchange.net/index.php?gamepage-appid-${appID}`);
            iconsEncoding += 9;
        }

        if (settings.wantBundles && bundles && bundles[appID] && bundles[appID].bundles && bundles[appID].bundles > 0) { // if bundled and enabled
            html += getIconHTML(settings.bundleColor, `Game (${appID}) has been in ${bundles[appID].bundles} bundle${bundles[appID].bundles === 1 ? "" : "s"}`, blcs, settings.bundleIcon, `https://barter.vg/steam/app/${appID}/#bundles`);
            iconsEncoding += 10;
        }

        const today = new Date().toLocaleString("sv-SE");
        if (today.includes("-04-01 ")) {
            html += getIconHTML("green", "April Fools!\nClick for the joke :)", today, "triangle-exclamation", "https://steamcommunity.com/groups/RemGC");
        }

        if (settings.prefix) {
            elem.parentNode.insertBefore(getBoxNode(html, iconsEncoding, appID, settings.boxDynamicColor), elem);
        } else {
            elem.parentNode.insertBefore(getBoxNode(html, iconsEncoding, appID, settings.boxDynamicColor), elem.nextSibling);
        }

        elem.parentNode.style.overflow = "visible";
    }, 0);
}

function doSub(settings, elem, ownedPackages, bundles, lcs, blcs) {
    elem.classList.add("swi");

    /* Example detectable links:
     * https://barter.vg/steam/sub/469/
     * https://steamdb.info/sub/469/
     * https://store.steampowered.com/sub/469/
     */

    const attr = settings.attributes.find((a) => /sub\/[0-9]+/g.test(elem.getAttribute(a)));
    if (!attr) {
        return;
    }

    const attrVal = elem.getAttribute(attr);
    const subID = Number(attrVal.match(/sub\/[0-9]+/g)[0].split("sub/")[1]);
    if (Number.isNaN(subID)) {
        return;
    }

    setTimeout(() => {
        let html;
        let iconsEncoding = 0;

        if (ownedPackages[subID]) { // if owned
            html = getIconHTML(settings.ownedColor, `Package (${subID}) owned`, lcs, settings.ownedIcon);
            iconsEncoding += 1;
        } else { // else not owned
            html = getIconHTML(settings.unownedColor, `Package (${subID}) not owned`, lcs, settings.unownedIcon);
            iconsEncoding += 2;
        }

        if (settings.wantBundles && bundles && bundles[subID] && bundles[subID].bundles && bundles[subID].bundles > 0) { // if bundled and enabled
            html += getIconHTML(settings.bundleColor, `Package (${subID}) has been in ${bundles[subID].bundles} bundle${bundles[subID].bundles === 1 ? "" : "s"}`, blcs, settings.bundleIcon, `https://barter.vg/steam/sub/${subID}/#bundles`);
            iconsEncoding += 10;
        }

        if (settings.prefix) {
            elem.parentNode.insertBefore(getBoxNode(html, iconsEncoding, undefined, subID, settings.boxDynamicColor), elem);
        } else {
            elem.parentNode.insertBefore(getBoxNode(html, iconsEncoding, undefined, subID, settings.boxDynamicColor), elem.nextSibling);
        }

        elem.parentNode.style.overflow = "visible";
    }, 0);
}

function integrate(settings, userdata, decommissioned, cards, bundles, limited, dlcs, lastCached) {
    const { ignoredApps, ownedApps, ownedPackages, followedApps, wishlist } = userdata;

    const lcstr = new Date(lastCached.userdata).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);
    const dlcstr = new Date(lastCached.decommissioned).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);
    const dlclcstr = new Date(lastCached.dlcs).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);
    const llcstr = new Date(lastCached.limited).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);
    const clcstr = new Date(lastCached.cards).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);
    const blcstr = new Date(lastCached.bundles).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);

    const appSelector = [
        "[href*=\"steamcommunity.com/app/\"]",
        "[href*=\"steamdb.info/app/\"]",
        "[href*=\"store.steampowered.com/agecheck/app/\"]",
        "[href*=\"store.steampowered.com/app/\"]",
        "[href*=\"s.team/a/\"]",
        "[style*=\"cdn.akamai.steamstatic.com/steam/apps/\"]",
        "[style*=\"cdn.edgecast.steamstatic.com/steam/apps/\"]",
        "[style*=\"steamcdn-a.akamaihd.net/steam/apps/\"]",
        "[style*=\"steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/\"]",
        "[style*=\"cdn.cloudflare.steamstatic.com/steam/apps/\"]",
        "[style*=\"cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/\"]",
        "[style*=\"steamcdn-a.opskins.media/steam/apps/\"]",
        "[style*=\"steamcdn-a.opskins.media/steamcommunity/public/images/apps/\"]",
        "[style*=\"steamdb.info/static/camo/apps/\"]",
        "img[src*=\"cdn.akamai.steamstatic.com/steam/apps/\"]",
        "img[src*=\"cdn.edgecast.steamstatic.com/steam/apps/\"]",
        "img[src*=\"steamcdn-a.akamaihd.net/steam/apps/\"]",
        "img[src*=\"steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/\"]",
        "img[src*=\"cdn.cloudflare.steamstatic.com/steam/apps/\"]",
        "img[src*=\"cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/\"]",
        "img[src*=\"steamcdn-a.opskins.media/steam/apps/\"]",
        "img[src*=\"steamcdn-a.opskins.media/steamcommunity/public/images/apps/\"]",
        "img[src*=\"steamdb.info/static/camo/apps/\"]",
    ].filter((s) => settings.attributes.find((a) => s.includes(`[${a}`))).map((s) => `${s}:not(.swi)`)
        .join(", ");

    const subSelector = [
        "[href*=\"steamdb.info/sub/\"]",
        "[href*=\"store.steampowered.com/sub/\"]",
    ].map((s) => `${s}:not(.swi)`).join(", ");

    let delaySWI;
    const doSWI = (delay = 750) => {
        if (delaySWI) {
            clearTimeout(delaySWI);
        }

        delaySWI = setTimeout(() => {
            if (settings.dynamicContent !== "ping") {
                console.log("[Steam Web Integration] Executing");
            }

            clearTimeout(delaySWI);
            [...document.body.querySelectorAll(appSelector)]
                .forEach((elem) => doApp(settings, elem, wishlist, ownedApps, ignoredApps, followedApps, decommissioned, limited, cards, bundles, dlcs, lcstr, dlcstr, dlclcstr, llcstr, clcstr, blcstr));
            [...document.body.querySelectorAll(subSelector)]
                .forEach((elem) => doSub(settings, elem, ownedPackages, bundles, lcstr, blcstr), 0);
        }, delay);
    };

    let pinger = null;
    const clearSWI = () => {
        console.log("[Steam Web Integration] Clearing");
        [...document.body.querySelectorAll(".swi-block")].forEach((e) => e.remove());
        [...document.body.querySelectorAll(".swi")].forEach((e) => e.classList.remove("swi"));
        if (pinger) {
            clearInterval(pinger);
            pinger = null;
        }
    };

    const reloadSWI = () => {
        clearSWI();
        if (settings.dynamicContent === "ping") {
            pinger = setInterval(doSWI, settings.pingInterval);
        } else {
            doSWI(0);
        }
    };

    let setupSWI = () => {
        doSWI(0);

        chrome.runtime.onMessage.addListener((message) => {
            if (message.action === "runSWI") {
                doSWI(0);
            } else if (message.action === "clearSWI") {
                clearSWI();
            } else if (message.action === "reloadSWI") {
                reloadSWI();
            }
        });

        if (settings.dynamicContent === "disabled") {
            return;
        }

        // TODO: Implement observe mode
        if (settings.dynamicContent === "observe") {
            // $("body").observe({ "added": true, "attributes": true, "attributeFilter": settings.attributes }, appSelector, () => doSWI());
            // $("body").observe({ "added": true, "attributes": true, "attributeFilter": ["href"] }, subSelector, () => doSWI());
            console.log("[Steam Web Integration] Observe not implemented yet!");
        } else if (settings.dynamicContent === "ping") {
            pinger = setInterval(doSWI, settings.pingInterval);
        }
    };

    if (document.readyState === "complete" || document.readyState === "loaded") {
        setupSWI();
    }

    document.addEventListener("DOMContentLoaded", setupSWI);
}

function addStylesheet(url) {
    let link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL(url);
    document.head.appendChild(link);
}

function addStyle(css) {
    let style = document.createElement("style");
    style.innerHTML = css;
    document.head.appendChild(style);
}

async function init() {
    let settings = await chrome.runtime.sendMessage({ "action": "getSettings" });
    let css = `
        .swi-block {
            display: inline-block;
            line-height: initial;
            font-size: ${settings.iconsScale}em;
            font-weight: ${settings.iconsBold ? "bold" : "normal"};
        }
        .swi-block.swi-boxed {
            background: rgba(${convertToRGB(settings.boxColor).join(", ")}, ${settings.boxOpacity});
            border-radius: 5px;
            margin: auto 4px auto 4px;
            padding: 2px 4px 2px 4px;
            position: relative;
        }
        .swi-block > span {
            cursor: help;
            margin: 2px;
        }
        .swi-block > span > a {
            cursor: help;
            text-decoration: none;
        }
    `;

    const matchUrl = settings.blackList.split("\n").find((url) => location.href.includes(url.trim()));
    if ((settings.whiteListMode && matchUrl) || (!settings.whiteListMode && !matchUrl)) {
        boxNode = createBoxNode(settings.boxed);
        let data = await chrome.runtime.sendMessage({ "action": "getData" });
        let { userdata, decommissioned, cards, bundles, limited, dlcs, lastCached } = data;
        addStyle(css);
        addStylesheet("/css/fontawesome.min.css");
        addStylesheet("/css/solid.min.css");
        integrate(settings, userdata, decommissioned, cards, bundles, limited, dlcs, lastCached);
    }
}

init();
