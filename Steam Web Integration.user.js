// ==UserScript==
// @name         Steam Web Integration
// @icon         http://store.steampowered.com/favicon.ico
// @namespace    Royalgamer06
// @author       Royalgamer06
// @contributor  Black3ird
// @contributor  Lex
// @contributor  Luckz
// @version      1.7.1
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
// @connect      bartervg.com
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js
// @supportURL   https://www.steamgifts.com/discussion/y9vVm/
// @updateURL    https://github.com/Royalgamer06/SteamWebIntegration/raw/master/Steam%20Web%20Integration.user.js
// @downloadURL  https://github.com/Royalgamer06/SteamWebIntegration/raw/master/Steam%20Web%20Integration.user.js
// ==/UserScript==

// ==Configuration==
const prefix = false; //                            Prefix (true) instead of suffix (false) position icon.
const wantIgnores = true; //                        Whether (true) or not (false) you want to display an extra icon for ignored (not interested) apps.
const wantDecommissioned = true; //                 Whether (true) or not (false) you want to display an extra icon for removed or delisted (decommissioned) apps.
const wantCards = true; //                          Whether (true) or not (false) you want to display an extra icon for apps with cards.
const wantBundles = true; //                        Whether (true) or not (false) you want to display an extra icon for previously bundled apps.
const linkCardIcon = true; //                       Link the card icon to SteamCardExchange.net
const ignoredIcon = "&#128683;&#xFE0E;"; //         HTML entity code for '🛇' (default).
const ignoredColor = "grey"; //                     Color of the icon for ignored (not interested) apps.
const wishlistIcon = "&#10084;"; //                 HTML entity code for '❤' (default).
const wishlistColor = "hotpink"; //                 Color of the icon for wishlisted apps.
const ownedIcon = "&#10004;"; //                    HTML entity code for '✔' (default).
const ownedColor = "green"; //                      Color of the icon for owned apps and subs.
const unownedIcon = "&#10008;"; //                  HTML entity code for '✘' (default).
const unownedColor = "red"; //                      Color of the icon for unowned apps and subs.
const decommissionedIcon = "&#128465;"; //          HTML entity code for '🗑' (default). The symbol '☠' ("&#9760;") is a good alternative if the default symbol is unavailable.
const decommissionedColor = "initial"; //           Color of the icon for removed or delisted apps and subs.
const cardIcon = "&#x1F0A1"; //                     HTML entity code for '🂡' (default). ♠ ("&spades;") is an alternative if this symbol is unavailable.
const cardColor = "blue"; //                        Color of the icon for cards.
const bundleIcon = "&#127873;&#xFE0E;"; //          HTML entity code for '🎁︎' (default). Barter.vg uses the symbol '✽' ("&#10045;").
const bundleColor = "yellow"; //                    Color of the icon for bundled apps.
const userRefreshInterval = 0; //                   Number of minutes to wait to refresh cached userdata. 0 = always stay up-to-date.
const decommissionedRefreshInterval = 60 * 24; //   Number of minutes to wait to refresh cached userdata. 0 = always stay up-to-date, but not recommended.
const cardsRefreshInterval = 60 * 24 * 2; //        Number of minutes to wait to refresh cached trading card data and more. 0 = always stay up-to-date, but not recommended.
const dateOverride = false; //                      Force date display in the YYYY-MM-DD HH:MM:SS style; otherwise matches system locale.
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
                } catch (e) {
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
    const cachedCards = JSON.parse(GM_getValue("swi_tradingcards", null));
    const lastCachedCards = parseInt(GM_getValue("swi_tradingcards_last", 0)) || 1;
    if ((wantCards || wantBundles) && (Date.now() - lastCachedCards >= cardsRefreshInterval * 60000 || !cachedCards || Object.keys(cachedCards).length < 7000) || Object.values(cachedCards)[0].marketable === undefined) {
        GM_xmlhttpRequest({
            method: "GET",
            url: "http://bartervg.com/browse/cards/json/",
            timeout: 30000,
            onload: function(response) {
                var json = null;
                try {
                    json = JSON.parse(response.responseText);
                    if (Object.keys(json).length > 7000) { // sanity check
                        console.log(json);
                        GM_setValue("swi_tradingcards", JSON.stringify(json));
                        GM_setValue("swi_tradingcards_last", Date.now());
                    }
                    callback(json);
                } catch (error) {
                    console.log("Unable to parse Barter.vg data. Using cached data...", error);
                    callback(cachedCards);
                }
            },
            onerror: function(response) {
                console.log("An error occurred while refreshing Barter.vg data. Using cached data...", response);
                callback(cachedCards);
            },
            ontimeout: function() {
                console.log("It took too long to refresh Barter.vg data. Using cached data...");
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
    const lcs = dateOverride ? (new Date(lastCached)).toLocaleString("sv-SE") : (new Date(lastCached)).toLocaleString();
    const blcs = (new Date(GM_getValue("swi_tradingcards_last", 0))).toLocaleString(dateOverride ? "sv-SE" : undefined);
    const dlcs = (new Date(GM_getValue("swi_decommissioned_last", 0))).toLocaleString(dateOverride ? "sv-SE" : undefined);
    const appSelector = ":regex(href, ^(https?:)?\/\/(store\.steampowered\.com|steamcommunity\.com|steamdb\.info)\/(agecheck\/)?app\/[0-9]+), img[src*='cdn.akamai.steamstatic.com/steam/apps/'], img[src*='steamcdn-a.akamaihd.net/steam/apps/'], " +
        "img[src*='cdn.edgecast.steamstatic.com/steam/apps/'], img[src*='steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/'], img[src*='steamdb.info/static/camo/apps/']";
    const subSelector = ":regex(href, ^(https?:)?\/\/(store\.steampowered\.com|steamdb\.info)\/sub\/[0-9]+)";
    $(document).on("DOMSubtreeModified", appSelector, function() {
        doApp(this, wishlist, ownedApps, ignoredApps, decommissioned, cards, lcs, blcs, dlcs);
    }).on("DOMSubtreeModified", subSelector, function() {
        doSub(this, wishlist, ownedPackages, lcs);
    }).ready(function() {
        $(appSelector).each(function() {
            doApp(this, wishlist, ownedApps, ignoredApps, decommissioned, cards, lcs, blcs, dlcs);
        });
        $(subSelector).each(function() {
            doSub(this, wishlist, ownedPackages, lcs);
        });
    });
}

function doApp(elem, wishlist, ownedApps, ignoredApps, decommissioned, cards, lcs, blcs, dlcs) {
    if (!$(elem).hasClass("swi")) {
        $(elem).addClass("swi");
        setTimeout(function() {
            var appID = elem.href ? parseInt(elem.href.split("app/")[1].split("/")[0].split("?")[0].split("#")[0]) : parseInt(elem.src.split("apps/")[1].split("/")[0].split("?")[0].split("#")[0]);
            var html;
            if (ownedApps.includes(appID)) { //if owned
                html = "<span style='color: " + ownedColor + "; cursor: help;' title='Game or DLC (" + appID + ") owned on Steam\nLast updated: " + lcs + "'> " + ownedIcon + "</span>"; //✔
            } else { //else not owned
                if (wishlist.includes(appID)) { //if wishlisted
                    html = "<span style='color: " + wishlistColor + "; cursor: help;' title='Game or DLC (" + appID + ") wishlisted on Steam\nLast updated: " + lcs + "'> " + wishlistIcon + "</span>"; //❤
                } else { //else not wishlisted
                    html = "<span style='color: " + unownedColor + "; cursor: help;' title='Game or DLC (" + appID + ") not owned on Steam\nLast updated: " + lcs + "'> " + unownedIcon + "</span>"; //✘
                }
            }
            if (ignoredApps.includes(appID) && wantIgnores) { //if ignored and enabled
                html += "<span style='color: " + ignoredColor + "; cursor: help;' title='Game or DLC (" + appID + ") ignored on Steam\nLast updated: " + lcs + "'> " + ignoredIcon + "</span>"; //🛇
            }
            var app = decommissioned.filter(function(obj) {
                return obj.appid === appID.toString();
            })[0];
            if (app && wantDecommissioned) { //if decommissioned and enabled
                html += "<span style='color: " + decommissionedColor + "; cursor: help;' title='The " + app.type + " \"" + app.name.replace(/'/g, "") + "\" (" + appID + ") is " +
                    app.category.toLowerCase() + " and has only " + app.count + " confirmed owners on Steam\nLast updated: " + dlcs + "'> " + decommissionedIcon + "</span>"; //🗑
            }
            if (wantCards && cards[appID] !== undefined && cards[appID].cards !== undefined && cards[appID].cards > 0) { //if has cards and enabled
                html += "<span style='color: " + cardColor + "; cursor: help;' title='Game (" + appID + ") has " + cards[appID].cards + (cards[appID].marketable ? " " : " un") + "marketable cards\nLast updated: " + blcs + "'> " + (linkCardIcon ?
                    "<a href='http://www.steamcardexchange.net/index.php?gamepage-appid-" + appID + "' target='_blank'>" + cardIcon + "</a>" :
                    cardIcon) + "</span>";
            }
            if (wantBundles && cards[appID] !== undefined && cards[appID].bundles !== undefined && cards[appID].bundles > 0) { //if is bundled and enabled
                html += "<span style='color: " + bundleColor + "; cursor: help;' title='Game (" + appID + ") has been in " + cards[appID].bundles + " bundles\nLast updated: " + blcs + "'> " +
                    "<a href='https://barter.vg/steam/app/" + appID + "' target='_blank'>" + bundleIcon + "</a></span>";
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
