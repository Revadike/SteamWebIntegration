// ==UserScript==
// @author       Revadike
// @connect      bartervg.com
// @connect      steam-tracker.com
// @connect      store.steampowered.com
// @contributor  Barter.vg
// @contributor  Black3ird
// @contributor  Lex
// @contributor  Luckz
// @description  Check every web page for game, dlc and package links to the steam store and mark using icons whether it's owned, unowned, wishlisted, ignored (not interested), DLC, removed/delisted (decommissioned), has low confidence metric, has cards, or is bundled.
// @downloadURL  https://github.com/Revadike/SteamWebIntegration/raw/master/Steam%20Web%20Integration.user.js
// @exclude      /^https?\:\/\/(.+.steampowered|steamcommunity).com\/(?!groups\/groupbuys).*/
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_info
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @homepageURL  https://www.steamgifts.com/discussion/y9vVm/
// @icon         https://store.steampowered.com/favicon.ico
// @include      /^https?\:\/\/.+/
// @name         Steam Web Integration
// @namespace    Royalgamer06
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require      https://raw.githubusercontent.com/kapetan/jquery-observe/master/jquery-observe.js
// @run-at       document-start
// @supportURL   https://github.com/Revadike/SteamWebIntegration/issues/
// @updateURL    https://github.com/Revadike/SteamWebIntegration/raw/master/Steam%20Web%20Integration.user.js
// @version      1.9.2
// ==/UserScript==

// ==Code==
(() => {
    // eslint-disable-next-line no-multi-assign
    this.$ = this.jQuery = jQuery.noConflict(true);
    let settings, boxNode;

    function displaySettings() {
        const { name, version, author } = GM_info.script;
        $(`#title`).text(`${name} (${version}) by ${author}`);
        $(`#settings`).show();
        $(`#notinstalled`).hide();

        Object.keys(settings).forEach((name) => {
            const value = settings[name];
            if (typeof value === `boolean`) {
                $(`#${name}`).prop(`checked`, value);
            } else {
                $(`#${name}`).val(value);
            }
        });
    }

    function showToast() {
        $(`#snackbar`).addClass(`show`);
        setTimeout(() => $(`#snackbar`).removeClass(`show`), 3000);
    }

    function onChange(elem) {
        const name = $(elem).attr(`name`);
        const val = $(elem).val();

        if (elem.type === `checkbox`) {
            settings[name] = $(elem).prop(`checked`);
        } else {
            settings[elem.name] = Number.isFinite(val) ? parseInt(val, 10) : val;
        }

        GM_setValue(`swi_settings`, JSON.stringify(settings));
        showToast();
    }

    function createBoxNode() {
        return $(`<div/>`, {
            "class": `swi-block${settings.boxed ? ` boxed` : ``}`
        });
    }

    function getIconHTML(color, str, lcs, icon, link) {
        const { name, version, author } = GM_info.script;
        const titlePlus = `\nLast updated at ${lcs}\n${name} (${version}) by ${author}`;
        if (link) {
            return `<span title="${str}\n${titlePlus}"><a style="color: ${color} !important;" href="${link}" target="_blank">${icon}</a></span>`;
        }

        return `<span style="color: ${color} !important;" title="${str} on Steam\n${titlePlus}">${icon}</span>`;
    }

    function getBoxNode(html, appID, subID) {
        const node = boxNode.clone(false, false);
        if (subID) {
            node.attr(`data-subid`, subID);
        } else {
            node.attr(`data-appid`, appID);
        }
        node.html(html);
        return node;
    }

    function refreshDecommissioned(callback) {
        if (!settings.wantDecommissioned) {
            callback();
            return;
        }

        const cachedDecommissioned = JSON.parse(GM_getValue(`swi_decommissioned`, null));
        const lastCachedDecommissioned = GM_getValue(`swi_decommissioned_last`, 0);
        if (cachedDecommissioned && Date.now() - lastCachedDecommissioned < settings.decommissionedRefreshInterval * 60000) {
            callback(cachedDecommissioned);
            return;
        }

        GM_xmlhttpRequest({
            "method": `GET`,
            "url": `https://steam-tracker.com/api?action=GetAppListV3`,
            "timeout": 30000,
            "onload": (response) => {
                let json = null;
                try {
                    json = JSON.parse(response.responseText);
                    if (json.success) {
                        GM_setValue(`swi_decommissioned`, JSON.stringify(json.removed_apps));
                        GM_setValue(`swi_decommissioned_last`, Date.now());
                    }
                    callback(json.removed_apps);
                    return;
                } catch (error) {
                    console.log(`Unable to parse removed steam games data. Using cached data...`, error);
                }
                callback(cachedDecommissioned);
            },
            "onerror": () => {
                console.log(`An error occurred while refreshing removed steam games data. Using cached data...`);
                callback(cachedDecommissioned);
            },
            "ontimeout": () => {
                console.log(`It took too long to refresh removed steam games data. Using cached data...`);
                callback(cachedDecommissioned);
            }
        });
    }

    function refreshDLC(callback) {
        if (!settings.wantDLC) {
            callback();
            return;
        }

        const cachedDLC = JSON.parse(GM_getValue(`swi_dlc`, null));
        const lastCachedDLC = parseInt(GM_getValue(`swi_dlc_last`, 0), 10) || 1;
        if (cachedDLC && Object.keys(cachedDLC).length > 7000 && Date.now() - lastCachedDLC < settings.dlcRefreshInterval * 60000) {
            callback(cachedDLC);
            return;
        }

        GM_xmlhttpRequest({
            "method": `GET`,
            "url": `https://bartervg.com/browse/dlc/json/`,
            "timeout": 30000,
            "onload": (response) => {
                let json = null;
                try {
                    json = JSON.parse(response.responseText);
                    if (Object.keys(json).length > 7000) { // sanity check
                        GM_setValue(`swi_dlc`, JSON.stringify(json));
                        GM_setValue(`swi_dlc_last`, Date.now());
                    }
                    callback(json);
                    return;
                } catch (error) {
                    console.log(`Unable to parse Barter.vg downloadable content data. Using cached data...`, error);
                }
                callback(cachedDLC);
            },
            "onerror": (response) => {
                console.log(`An error occurred while refreshing Barter.vg downloadable content data. Using cached data...`, response);
                callback(cachedDLC);
            },
            "ontimeout": () => {
                console.log(`It took too long to refresh Barter.vg downloadable content data. Using cached data...`);
                callback(cachedDLC);
            }
        });
    }

    function refreshLimited(callback) {
        if (!settings.wantLimited) {
            callback();
            return;
        }

        const cachedLimited = JSON.parse(GM_getValue(`swi_limited`, null));
        const lastCachedLimited = parseInt(GM_getValue(`swi_limited_last`, 0), 10) || 1;
        if (cachedLimited && Object.keys(cachedLimited).length > 7000 && Date.now() - lastCachedLimited < settings.limitedRefreshInterval * 60000) {
            callback(cachedLimited);
            return;
        }

        GM_xmlhttpRequest({
            "method": `GET`,
            "url": `https://bartervg.com/browse/tag/481/json/`,
            "timeout": 30000,
            "onload": (response) => {
                let json = null;
                try {
                    json = JSON.parse(response.responseText);
                    if (Object.keys(json).length > 7000) { // sanity check
                        GM_setValue(`swi_limited`, JSON.stringify(json));
                        GM_setValue(`swi_limited_last`, Date.now());
                    }
                    callback(json);
                    return;
                } catch (error) {
                    console.log(`Unable to parse Barter.vg low confidence metric data. Using cached data...`, error);
                }
                callback(cachedLimited);
            },
            "onerror": (response) => {
                console.log(`An error occurred while refreshing Barter.vg low confidence metric data. Using cached data...`, response);
                callback(cachedLimited);
            },
            "ontimeout": () => {
                console.log(`It took too long to refresh Barter.vg low confidence metric data. Using cached data...`);
                callback(cachedLimited);
            }
        });
    }

    function refreshCards(callback) {
        if (!settings.wantCards) {
            callback();
            return;
        }

        const cachedCards = JSON.parse(GM_getValue(`swi_tradingcards`, null));
        const lastCachedCards = parseInt(GM_getValue(`swi_tradingcards_last`, 0), 10) || 1;
        if (cachedCards && Object.keys(cachedCards).length > 7000 && Object.values(cachedCards)[0].marketable && Date.now() - lastCachedCards < settings.cardsRefreshInterval * 60000) {
            callback(cachedCards);
            return;
        }

        GM_xmlhttpRequest({
            "method": `GET`,
            "url": `https://bartervg.com/browse/cards/json/`,
            "timeout": 30000,
            "onload": (response) => {
                let json = null;
                try {
                    json = JSON.parse(response.responseText);
                    if (Object.keys(json).length > 7000) { // sanity check
                        GM_setValue(`swi_tradingcards`, JSON.stringify(json));
                        GM_setValue(`swi_tradingcards_last`, Date.now());
                    }
                    callback(json);
                    return;
                } catch (error) {
                    console.log(`Unable to parse Barter.vg trading cards data. Using cached data...`, error);
                }
                callback(cachedCards);
            },
            "onerror": (response) => {
                console.log(`An error occurred while refreshing Barter.vg trading cards data. Using cached data...`, response);
                callback(cachedCards);
            },
            "ontimeout": () => {
                console.log(`It took too long to refresh Barter.vg trading cards data. Using cached data...`);
                callback(cachedCards);
            }
        });
    }

    function refreshBundles(callback) {
        if (!settings.wantBundles) {
            callback();
            return;
        }

        const cachedBundles = JSON.parse(GM_getValue(`swi_bundles`, null));
        const lastCachedBundles = parseInt(GM_getValue(`swi_bundles_last`, 0), 10) || 1;
        if (cachedBundles && Object.keys(cachedBundles).length > 7000 && Object.values(cachedBundles)[0].bundles && Date.now() - lastCachedBundles < settings.bundlesRefreshInterval * 60000) {
            callback(cachedBundles);
            return;
        }

        GM_xmlhttpRequest({
            "method": `GET`,
            "url": `https://bartervg.com/browse/bundles/json/`,
            "timeout": 30000,
            "onload": (response) => {
                let json = null;
                try {
                    json = JSON.parse(response.responseText);
                    if (Object.keys(json).length > 7000) { // sanity check
                        GM_setValue(`swi_bundles`, JSON.stringify(json));
                        GM_setValue(`swi_bundles_last`, Date.now());
                    }
                    callback(json);
                    return;
                } catch (error) {
                    console.log(`Unable to parse Barter.vg bundles data. Using cached data...`, error);
                }
                callback(cachedBundles);
            },
            "onerror": (response) => {
                console.log(`An error occurred while refreshing Barter.vg bundles data. Using cached data...`, response);
                callback(cachedBundles);
            },
            "ontimeout": () => {
                console.log(`It took too long to refresh Barter.vg bundles data. Using cached data...`);
                callback(cachedBundles);
            }
        });
    }

    function doApp(elem, wishlist, ownedApps, ignoredApps, decommissioned, limited, cards, bundles, dlc, lcs, dlcs, dlclcs, llcs, clcs, blcs) {
        $(elem).addClass(`swi`);

        const attr = settings.attributes.find((a) => /apps?\//g.test($(elem).attr(a)));
        const attrVal = $(elem).attr(attr);
        const appID = parseInt(attrVal.match(/apps?\/[0-9]+/g)[0].split(/apps?\//)[1], 10);
        if (Number.isNaN(appID)) {
            return;
        }

        setTimeout(() => {
            let html;
            let subject;
            if (dlc && dlc[appID]) {
                subject = `DLC`;
            } else if (!dlc) {
                subject = `Game or DLC`;
            } else {
                subject = `Game`;
            }

            if (ownedApps && ownedApps.includes(appID)) { // if owned
                html = getIconHTML(settings.ownedColor, `${subject} (${appID}) owned`, lcs, settings.ownedIcon); // ✔
            } else if (wishlist.includes(appID)) { // if not owned and wishlisted
                html = getIconHTML(settings.wishlistColor, `${subject} (${appID}) wishlisted`, lcs, settings.wishlistIcon); // ❤
            } else { // else not owned and not wishlisted
                html = getIconHTML(settings.unownedColor, `${subject} (${appID}) not owned`, lcs, settings.unownedIcon); // ✘
            }

            if (settings.wantIgnores && ignoredApps && ignoredApps.includes(appID)) { // if ignored and enabled
                html += getIconHTML(settings.ignoredColor, `${subject} (${appID}) ignored`, llcs, settings.ignoredIcon); // 🛇
            }

            if (settings.wantDLC && dlc && dlc[appID]) { // if DLC and enabled
                const base = dlc[appID].base_appID;
                const ownsBase = ownedApps.includes(base);
                html += getIconHTML(settings.dlcColor, `${subject} (${appID}) is downloadable content for an ${ownsBase ? `` : `un`}owned base game (${base})`, dlclcs, settings.dlcIcon); // ⇩
            }

            if (settings.wantDecommissioned && decommissioned) { // if decommissioned and have cache or new data
                const app = decommissioned.find((obj) => obj.appid === appID.toString());
                if (app) { // if decommissioned?
                    html += getIconHTML(settings.decommissionedColor, `The ${app.type} '${app.name.replace(/"|'/g, ``)}' (${appID}) is ${app.category.toLowerCase()} and has only ${app.count} confirmed owner${app.count === 1 ? `` : `s`} on Steam`, dlcs, settings.decommissionedIcon, `https://steam-tracker.com/app/${appID}/`); // 🗑
                }
            }

            if (settings.wantLimited && limited && limited[appID]) { // if is limited
                html += getIconHTML(settings.limitedColor, `Game (${appID}) has profile features limited`, llcs, settings.limitedIcon); // ⚙
            }

            if (settings.wantCards && cards && cards[appID] && cards[appID].cards && cards[appID].cards > 0) { // if has cards and enabled
                html += getIconHTML(settings.cardColor, `Game (${appID}) has ${cards[appID].cards} ${cards[appID].marketable ? `` : `un`}marketable card${cards[appID].cards === 1 ? `` : `s`}`, clcs, settings.cardIcon, `https://www.steamcardexchange.net/index.php?gamepage-appid-${appID}`);
            }

            if (settings.wantBundles && bundles && bundles[appID] && bundles[appID].bundles && bundles[appID].bundles > 0) { // if is bundled and enabled
                html += getIconHTML(settings.bundleColor, `Game (${appID}) has been in ${bundles[appID].bundles} bundle${bundles[appID].bundles === 1 ? `` : `s`}`, blcs, settings.bundleIcon, `https://barter.vg/steam/app/${appID}/#bundles`);
            }

            if (settings.prefix) {
                $(elem).before(getBoxNode(html, appID));
            } else {
                $(elem).after(getBoxNode(html, appID));
            }

            $(elem).parent().css(`overflow`, `visible`);
        }, 0);
    }

    function doSub(elem, ownedPackages, lcs) {
        $(elem).addClass(`swi`);
        const subID = parseInt(elem.href.match(/sub\/[0-9]+/g)[0].split(`sub/`)[1], 10);
        if (Number.isNaN(subID)) {
            return;
        }

        setTimeout(() => {
            let html;

            if (ownedPackages.includes(subID)) { // if owned
                html = getIconHTML(settings.ownedColor, `Package (${subID}) owned`, lcs, settings.ownedIcon); // ✔
            } else { // else not owned
                html = getIconHTML(settings.unownedColor, `Package (${subID}) not owned`, lcs, settings.unownedIcon); // ✖
            }

            if (settings.prefix) {
                $(elem).before(getBoxNode(html, undefined, subID));
            } else {
                $(elem).after(getBoxNode(html, undefined, subID));
            }

            $(elem).parent().css(`overflow`, `visible`);
        }, 0);
    }

    function integrate(userdata, decommissioned, cards, bundles, limited, dlc) {
        let ignoredApps = Object.keys(userdata.rgIgnoredApps).map((a) => parseInt(a, 10));
        let ownedApps = userdata.rgOwnedApps;
        let ownedPackages = userdata.rgOwnedPackages;
        let wishlist = userdata.rgWishlist;
        let lastCached = GM_getValue(`swi_last`, 0);

        if (ownedApps.length === 0 && ownedPackages.length === 0 && ignoredApps.length === 0 && wishlist.length === 0) {
            const parsedCachedJson = JSON.parse(GM_getValue(`swi_data`, null));
            ignoredApps = parsedCachedJson.rgIgnoredApps;
            ownedApps = parsedCachedJson.rgOwnedApps;
            ownedPackages = parsedCachedJson.rgOwnedPackages;
            wishlist = parsedCachedJson.rgWishlist;
        } else {
            lastCached = Date.now();
            GM_setValue(`swi_last`, lastCached);
            GM_setValue(`swi_data`, JSON.stringify(userdata));
        }

        const lcs = settings.dateOverride ? (new Date(lastCached)).toLocaleString(`sv-SE`) : (new Date(lastCached)).toLocaleString();
        const dlcs = (new Date(GM_getValue(`swi_decommissioned_last`, 0))).toLocaleString(settings.dateOverride ? `sv-SE` : undefined);
        const dlclcs = (new Date(GM_getValue(`swi_dlc_last`, 0))).toLocaleString(settings.dateOverride ? `sv-SE` : undefined);
        const llcs = (new Date(GM_getValue(`swi_limited_last`, 0))).toLocaleString(settings.dateOverride ? `sv-SE` : undefined);
        const clcs = (new Date(GM_getValue(`swi_tradingcards_last`, 0))).toLocaleString(settings.dateOverride ? `sv-SE` : undefined);
        const blcs = (new Date(GM_getValue(`swi_bundles_last`, 0))).toLocaleString(settings.dateOverride ? `sv-SE` : undefined);

        const appSelector = [
            `[href*="steamcommunity.com/app/"]`,
            `[href*="steamdb.info/app/"]`,
            `[href*="store.steampowered.com/agecheck/app/"]`,
            `[href*="store.steampowered.com/app/"]`,
            `[style*="cdn.akamai.steamstatic.com/steam/apps/"]`,
            `[style*="cdn.edgecast.steamstatic.com/steam/apps/"]`,
            `[style*="steamcdn-a.akamaihd.net/steam/apps/"]`,
            `[style*="steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/"]`,
            `[style*="steamcdn-a.opskins.media/steam/apps/"]`,
            `[style*="steamcdn-a.opskins.media/steamcommunity/public/images/apps/"]`,
            `[style*="steamdb.info/static/camo/apps/"]`,
            `img[src*="cdn.akamai.steamstatic.com/steam/apps/"]`,
            `img[src*="cdn.edgecast.steamstatic.com/steam/apps/"]`,
            `img[src*="steamcdn-a.akamaihd.net/steam/apps/"]`,
            `img[src*="steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/"]`,
            `img[src*="steamcdn-a.opskins.media/steam/apps/"]`,
            `img[src*="steamcdn-a.opskins.media/steamcommunity/public/images/apps/"]`,
            `img[src*="steamdb.info/static/camo/apps/"]`
        ].filter((s) => settings.attributes.find((a) => s.includes(`[${a}`))).map((s) => `${s}:not(.swi)`).join(`, `);

        const subSelector = [
            `[href*="steamdb.info/sub/"]`,
            `[href*="store.steampowered.com/sub/"]`
        ].map((s) => `${s}:not(.swi)`).join(`, `);

        let delaySWI;
        const doSWI = (delay = 750) => {
            if (delaySWI) {
                clearTimeout(delaySWI);
            }

            delaySWI = setTimeout(() => {
                console.log(`[Steam Web Integration] Executing`);
                clearTimeout(delaySWI);
                $(appSelector, document.body).get().forEach((elem) => doApp(elem, wishlist, ownedApps, ignoredApps, decommissioned, limited, cards, bundles, dlc, lcs, dlcs, dlclcs, llcs, clcs, blcs));
                $(subSelector, document.body).get().forEach((elem) => doSub(elem, ownedPackages, lcs), 0);
            }, delay);
        };

        const clearSWI = () => {
            console.log(`[Steam Web Integration] Clearing`);
            $(`.swi-block`).remove();
            $(`.swi`).removeClass(`swi`);
        };

        const reloadSWI = () => {
            clearSWI();
            doSWI(0);
        };

        $(document).ready(() => {
            doSWI(0);
            $(`body`).observe({ "added": true, "attributes": true, "attributeFilter": settings.attributes }, appSelector, () => doSWI());
            $(`body`).observe({ "added": true, "attributes": true, "attributeFilter": [`href`] }, subSelector, () => doSWI());

            GM_registerMenuCommand(`Run again`, () => doSWI(0));
            GM_registerMenuCommand(`Clear all`, clearSWI);
            GM_registerMenuCommand(`Clear and run (reload)`, reloadSWI);

            unsafeWindow.doSWI = doSWI;
            unsafeWindow.clearSWI = clearSWI;
            unsafeWindow.reloadSWI = reloadSWI;
        });
    }

    function refresh() {
        const cachedJson = GM_getValue(`swi_data`, null);
        const lastCached = GM_getValue(`swi_last`, 0);

        if (cachedJson && Date.now() - lastCached < settings.userRefreshInterval * 60000) {
            const userdata = JSON.parse(cachedJson);
            refreshDecommissioned((decommissioned) => refreshDLC((dlc) => refreshLimited((limited) => refreshCards((cards) => refreshBundles((bundles) => integrate(userdata, decommissioned, cards, bundles, limited, dlc))))));
            return;
        }

        GM_xmlhttpRequest({
            "method": `GET`,
            "url": `https://store.steampowered.com/dynamicstore/userdata/?t=${Date.now()}`,
            "onload": (response) => {
                const userdata = JSON.parse(response.responseText);
                refreshDecommissioned((decommissioned) => refreshDLC((dlc) => refreshLimited((limited) => refreshCards((cards) => refreshBundles((bundles) => integrate(userdata, decommissioned, cards, bundles, limited, dlc))))));
            }
        });
    }

    function init() {
        const settingsuri = `https://revadike.ga/swi/settings`;

        const defaults = {
            "attributes": [`href`, `src`, `style`],
            "boxed": true,
            "bundleColor": `#ffff00`,
            "bundleIcon": `&#127873;&#xFE0E;`,
            "bundlesRefreshInterval": 2880,
            "cardColor": `#0000ff`,
            "cardIcon": `&#x1F0A1`,
            "cardsRefreshInterval": 2880,
            "dateOverride": false,
            "decommissionedColor": `#ffffff`,
            "decommissionedIcon": `&#9760;`,
            "decommissionedRefreshInterval": 1440,
            "dlcColor": `#a655b2`,
            "dlcIcon": `&#8681;`,
            "dlcRefreshInterval": 1440,
            "ignoredColor": `#808080`,
            "ignoredIcon": `&#128683;&#xFE0E;`,
            "limitedColor": `#00ffff`,
            "limitedIcon": `&#9881;`,
            "limitedRefreshInterval": 2880,
            "ownedColor": `#008000`,
            "ownedIcon": `&#10004;`,
            "prefix": false,
            "unownedColor": `#ff0000`,
            "unownedIcon": `&#10008;`,
            "userRefreshInterval": 1,
            "wantBundles": true,
            "wantCards": true,
            "wantDecommissioned": true,
            "wantDLC": true,
            "wantIgnores": true,
            "wantLimited": true,
            "wishlistColor": `#ff69b4`,
            "wishlistIcon": `&#10084;`
        };

        const stylesheet = `
            .swi-block {
                display: inline-block;
                line-height: initial;
                z-index: 16777271;
            }
            .swi-block.boxed {
                background: rgba(0, 0, 0, 0.7);
                border-radius: 5px;
                margin: auto 4px auto 4px;
                padding: 2px 4px 2px 4px;
                position: relative;
            }
            .swi-block span {
                cursor: help;
                margin: 2px;
            }
            .swi-block a {
                text-decoration: none;
            }
        `;

        settings = JSON.parse(GM_getValue(`swi_settings`, JSON.stringify(defaults)));
        Object.keys(defaults).forEach((setting) => {
            if (settings[setting] !== undefined) {
                return;
            }

            settings[setting] = defaults[setting];
        });

        if (unsafeWindow.location.href.startsWith(settingsuri)) {
            unsafeWindow.onChange = onChange;
            unsafeWindow.scriptInfo = GM_info.script;
            unsafeWindow.settings = settings;
            $(document).ready(displaySettings);
        } else {
            boxNode = createBoxNode();
            GM_addStyle(stylesheet);
            GM_registerMenuCommand(`Change settings`, () => unsafeWindow.open(settingsuri, `_blank`));
            refresh();
        }
    }

    init();
})();
// ==/Code==