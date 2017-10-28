// ==UserScript==
// @name         Steam Web Integration
// @icon         http://store.steampowered.com/favicon.ico
// @namespace    Royalgamer06
// @author       Royalgamer06
// @contributor  Black3ird
// @contributor  Lex
// @version      1.6.5
// @description  Check every web page for game, dlc and package links to the steam store and mark if it's owned, unowned, ignored (not interested), removed/delisted (decommissioned), wishlisted or has cards using icons.
// @include      /^https?\:\/\/.+/
// @exclude      /^https?\:\/\/(.+\.steampowered|steamcommunity)\.com.*/
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// @connect      store.steampowered.com
// @connect      steam-tracker.com
// @connect      cdn.steam.tools
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js
// @supportURL   https://www.steamgifts.com/discussion/y9vVm/
// @updateURL    https://github.com/Royalgamer06/SteamWebIntegration/raw/master/Steam%20Web%20Integration.user.js
// @downloadURL  https://github.com/Royalgamer06/SteamWebIntegration/raw/master/Steam%20Web%20Integration.user.js
// ==/UserScript==

// ==Configuration==
const prefix = false; // Prefix (true) instead of suffix (false) position icon.
const wantIgnores = true; // Wether (true) or not (false) you want to display an extra icon for ignored (not interested) apps.
const wantDecommissioned = true; // Wether (true) or not (false) you want to display an extra icon for removed or delisted (decommissioned) apps.
const wantCards = true; // Whether (true) or not (false) you want to display an extra icon for apps with cards.
const linkCardIcon = true; // Link the card icon to SteamCardExchange.net
const ignoredIcon = "&#128683;&#xFE0E;"; // HTML entity code for '🛇' (default).
const ignoredColor = "grey"; // Color of the icon for ignored (not interested) apps.
const wishlistIcon = "&#10084;"; // HTML entity code for '❤' (default).
const wishlistColor = "hotpink"; // Color of the icon for wishlisted apps.
const ownedIcon = "&#10004;"; // HTML entity code for '✔' (default).
const ownedColor = "green"; // Color of the icon for owned apps and subs.
const unownedIcon = "&#10008;"; // HTML entity code for '✘' (default).
const unownedColor = "red"; // Color of the icon for unowned apps and subs.
const decommissionedIcon = "&#128465;"; // HTML entity code for '🗑' (default).
const decommissionedColor = "initial"; // Color of the icon for removed or delisted apps and subs.
const cardIcon = "&#x1F0A1"; // HTML entity code for '🂡' (default).
const cardColor = "blue"; // Color of the icon for cards.
const userRefreshInterval = 0; // Number of minutes to wait to refesh cached userdata. 0 = always stay up-to-date.
const decommissionedRefreshInterval = 60 * 24; // Number of minutes to wait to refesh cached userdata. 0 = always stay up-to-date.
const cardRefreshInterval = 60 * 24 * 2; // Number of minutes to wait to refesh cached trading card data. 0 = always stay up-to-date.
// ==/Configuration==

// ==Code==
this.$ = this.jQuery = jQuery.noConflict(true);
$.expr[":"].regex = function(elem, index, match) {
    var matchParams = match[3].split(","),
        validLabels = /^(data|css):/,
        attr = {
            method: matchParams[0].match(validLabels) ? matchParams[0].split(":")[0] : "attr",
            property: matchParams.shift().replace(validLabels, "")
        },
        regexFlags = "ig",
        regex = new RegExp(matchParams.join("").replace(/^\s+|\s+$/g, ""), regexFlags);
    return regex.test(jQuery(elem)[attr.method](attr.property));
};
refresh();

function refresh() {
    const cachedJson = GM_getValue("swi_data", null);
    const lastCached = GM_getValue("swi_last", 0);
    if (Date.now() - lastCached >= userRefreshInterval * 60000 || !cachedJson) {
        var v = parseInt(GM_getValue("swi_v", "1")) + 1;
        GM_xmlhttpRequest({
            method: "GET",
            url: "http://store.steampowered.com/dynamicstore/userdata/?v=" + v,
            onload: function(response) {
                GM_setValue("swi_v", v);
                refreshDecommissioned(function(decommissioned) {
                    refreshCards(function(cards) {
                        init(JSON.parse(response.responseText), decommissioned, cards);
                    });
                });
            }
        });
    } else {
        refreshDecommissioned(function(decommissioned) {
            refreshCards(function(cards) {
                init(JSON.parse(cachedJson), decommissioned, cards);
            });
        });
    }
}

function refreshDecommissioned(callback) {
    const cachedDecommissioned = JSON.parse(GM_getValue("swi_decommissioned", null));
    const lastCachedDecommissioned = GM_getValue("swi_decommissioned_last", 0);
    if (wantDecommissioned && (Date.now() - lastCachedDecommissioned >= decommissionedRefreshInterval * 60000 || !cachedDecommissioned)) {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://steam-tracker.com/api?action=GetAppListV3",
            timeout: 30000,
            onload: function(response) {
                var json = null;
                try {
                    json = JSON.parse(response.responseText);
                    if (json.success) {
                        GM_setValue("swi_decommissioned", JSON.stringify(json.removed_apps));
                        GM_setValue("swi_decommissioned_last", Date.now());
                    }
                    callback(json.removed_apps);
                } catch(e) {
                    console.log("Unable to parse removed steam games data. Using cached data...", e);
                    callback(cachedDecommissioned);
                }
            },
            onerror: function() {
                console.log("An error occurred while refreshing removed steam games data. Using cached data...");
                callback(cachedDecommissioned);
            },
            ontimeout: function() {
                console.log("It took too long to refresh removed steam games data. Using cached data...");
                callback(cachedDecommissioned);
            }
        });
    } else {
        callback(cachedDecommissioned);
    }
}

function refreshCards(callback) {
    const cachedCards = JSON.parse(GM_getValue("swi_cards", null));
    const lastCachedCards = GM_getValue("swi_cards_last", 0);
    if (wantCards && (Date.now() - lastCachedCards >= cardRefreshInterval * 60000 || !cachedCards || cachedCards.length < 7000)) {
        GM_xmlhttpRequest({
            method: "GET",
            url: "http://cdn.steam.tools/data/set_data.json",
            timeout: 30000,
            onload: function(response) {
                var json = null;
                try {
                    json = JSON.parse(response.responseText).sets.map(function(game) {
                        return parseInt(game.appid);
                    });
                    if (json.length > 7000) { // sanity check
                        console.log(json);
                        GM_setValue("swi_cards", JSON.stringify(json));
                        GM_setValue("swi_cards_last", Date.now());
                    }
                    callback(json);
                } catch(e) {
                    console.log("Unable to parse steam trading cards data. Using cached data...", e);
                    callback(cachedCards);
                }
            },
            onerror: function() {
                console.log("An error occurred while refreshing steam trading cards data. Using cached data...");
                callback(cachedCards);
            },
            ontimeout: function() {
                console.log("It took too long to refresh steam trading cards data. Using cached data...");
                callback(cachedCards);
            }
        });
    } else {
        callback(cachedCards);
    }
}

function init(userdata, decommissioned, cards) {
    var ignoredApps = userdata.rgIgnoredApps;
    var ownedApps = userdata.rgOwnedApps;
    var ownedPackages = userdata.rgOwnedPackages;
    var wishlist = userdata.rgWishlist;
    var lastCached = GM_getValue("swi_last", 0);
    if (ownedApps.length === 0 && ownedPackages.length === 0 && ignoredApps.length === 0 && wishlist.length === 0) {
        const parsedCachedJson = JSON.parse(GM_getValue("swi_data", null));
        ignoredApps = parsedCachedJson.rgIgnoredApps;
        ownedApps = parsedCachedJson.rgOwnedApps;
        ownedPackages = parsedCachedJson.rgOwnedPackages;
        wishlist = parsedCachedJson.rgWishlist;
    } else {
        lastCached = Date.now();
        GM_setValue("swi_last", lastCached);
        GM_setValue("swi_data", JSON.stringify(userdata));
    }
    const lcs = (new Date(lastCached)).toLocaleString();
    const clcs = (new Date(GM_getValue("swi_cards_last", 0))).toLocaleString();
    const dlcs = (new Date(GM_getValue("swi_decommissioned_last", 0))).toLocaleString();
    const appSelector = ":regex(href, ^(https?:)?\/\/(store\.steampowered\.com|steamcommunity\.com|steamdb\.info)\/(agecheck\/)?app\/[0-9]+), img[src*='cdn.akamai.steamstatic.com/steam/apps/'], img[src*='steamcdn-a.akamaihd.net/steam/apps/']";
    const subSelector = ":regex(href, ^(https?:)?\/\/(store\.steampowered\.com|steamdb\.info)\/sub\/[0-9]+)";
    $(document).on("DOMSubtreeModified", appSelector, function() {
        doApp(this, wishlist, ownedApps, ignoredApps, decommissioned, cards, lcs, clcs, dlcs);
    }).on("DOMSubtreeModified", subSelector, function() {
        doSub(this, wishlist, ownedPackages, lcs);
    }).ready(function() {
        $(appSelector).each(function() {
            doApp(this, wishlist, ownedApps, ignoredApps, decommissioned, cards, lcs, clcs, dlcs);
        });
        $(subSelector).each(function() {
            doSub(this, wishlist, ownedPackages, lcs);
        });
    });
}

function doApp(elem, wishlist, ownedApps, ignoredApps, decommissioned, cards, lcs, clcs, dlcs) {
    if (!$(elem).hasClass("swi")) {
        $(elem).addClass("swi");
        setTimeout(function() {
            var appID = elem.href ? parseInt(elem.href.split("app/")[1].split("/")[0].split("?")[0].split("#")[0]) : parseInt(elem.src.split("apps/")[1].split("/")[0].split("?")[0].split("#")[0]);
            var html;
            if ($.inArray(appID, ownedApps) > -1) { //if owned
                html = "<span style='color: " + ownedColor + "; cursor: help;' title='Game or DLC (" + appID + ") owned on Steam\nLast updated: " + lcs + "'> " + ownedIcon + "</span>"; //✔
            } else { //else not owned
                if ($.inArray(appID, wishlist) > -1) { //if wishlisted
                    html = "<span style='color: " + wishlistColor + "; cursor: help;' title='Game or DLC (" + appID + ") wishlisted on Steam\nLast updated: " + lcs + "'> " + wishlistIcon + "</span>"; //❤
                } else { //else not wishlisted
                    html = "<span style='color: " + unownedColor + "; cursor: help;' title='Game or DLC (" + appID + ") not owned on Steam\nLast updated: " + lcs + "'> " + unownedIcon + "</span>"; //✘
                }
            }
            if ($.inArray(appID, ignoredApps) > -1 && wantIgnores) { //if ignored and enabled
                html += "<span style='color: " + ignoredColor + "; cursor: help;' title='Game or DLC (" + appID + ") ignored on Steam\nLast updated: " + lcs + "'> " + ignoredIcon + "</span>"; //🛇
            }
            var app = decommissioned.filter(function(obj) {
                return obj.appid === appID.toString();
            })[0];
            if (app && wantDecommissioned) { //if decommissioned and enabled
                html += "<span style='color: " + decommissionedColor + "; cursor: help;' title='The " + app.type + " \"" + app.name.replace(/'/g, "") + "\" (" + appID + ") is " +
                    app.category.toLowerCase() + " and has only " + app.count + " confirmed owners on Steam\nLast updated: " + dlcs + "'> " + decommissionedIcon + "</span>"; //🗑
            }
            if (wantCards && cards.includes(appID)) { //if has cards and enabled
                html += "<span style='color: " + cardColor + "; cursor: help;' title='Game or DLC (" + appID + ") has cards\nLast updated: " + clcs + "'> " + (linkCardIcon ?
                    "<a href='http://www.steamcardexchange.net/index.php?gamepage-appid-" + appID + "' target='_blank'>" + cardIcon + "</a>" :
                    cardIcon) + "</span>";
            }
            if (prefix) {
                $(elem).before(html);
            } else {
                $(elem).after(html);
            }
            $(elem).parent().css("overflow", "visible");
        }, 0);
    }
}

function doSub(elem, wishlist, ownedPackages, lcs) {
    if (!$(elem).hasClass("swi")) {
        $(elem).addClass("swi");
        setTimeout(function() {
            var subID = parseInt(elem.href.split("sub/")[1].split("/")[0].split("?")[0].split("#")[0]);
            var html;
            if ($.inArray(subID, ownedPackages) > -1) { //if owned
                html = "<span style='color: " + ownedColor + "; cursor: help;' title='Package owned on Steam\nLast updated: " + lcs + "'> " + ownedIcon + "</span>"; //✔
            } else { //else not owned
                html = "<span style='color: " + unownedColor + "; cursor: help;' title='Package not owned on Steam\nLast updated: " + lcs + "'> " + unownedIcon + "</span>"; //✖
            }
            if (prefix) {
                $(elem).before(html);
            } else {
                $(elem).after(html);
            }
            $(elem).parent().css("overflow", "visible");
        }, 0);
    }
}
// ==/Code==
