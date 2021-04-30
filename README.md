![image](https://user-images.githubusercontent.com/4411977/116749354-1a6d6c00-aa01-11eb-8f5c-ae7a6936532a.png)

# [UserScript] Steam Web Integration

[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-up%20to%20date-green.svg)](https://tampermonkey.net/)
[![GitHub issues](https://img.shields.io/github/issues/Revadike/SteamWebIntegration)](https://github.com/Revadike/SteamWebIntegration/issues)
[![GitHub stars](https://img.shields.io/github/stars/Revadike/SteamWebIntegration)](https://github.com/Revadike/SteamWebIntegration/stargazers)
[![GitHub license](https://img.shields.io/github/license/Revadike/SteamWebIntegration)](https://github.com/Revadike/SteamWebIntegration/blob/master/LICENSE)

> Integrate your personal Steam information on the web, at your convenience!
> 
## Features
 * Checks web pages for links or images of steam games or DLC
 * Displays informative icons next to the link or image
 * Shows tooltips with additional information (on icon hover)
 * Information includes:
   * Type (game, DLC or package)
   * Ownership on Steam
   * Wishlisted on Steam
   * Followed on Steam
   * Ignored on Steam
   * Delisted/removed from Steam
   * Limited on Steam (low confidence metric)
   * Steam Trading Cards
   * Game bundle history
 * Caching of data
 * Support for dynamically changing web content
 * Context menu options
 * Highly configurable ([here](https://revadike.com/swi/settings/))

## Prerequisites 
 * Userscript manager, such as [Tampermonkey](http://tampermonkey.net/) (recommended)

## Download
 * [Direct download](https://github.com/Revadike/SteamWebIntegration/raw/master/Steam%20Web%20Integration.user.js) (latest)
 * [All releases](https://github.com/Revadike/SteamWebIntegration/releases)

## FAQ

### How do I change the settings?
Right [here](https://revadike.com/swi/settings/).

### How can I blacklist a domain?
Right [here](https://revadike.com/swi/settings/).

### Why are the ownership/wishlist icons not working or incorrect?
Make sure you are logged in to steam with the right account in your web browser and visit [this page](http://store.steampowered.com/dynamicstore/userdata/) and refresh until you can see all your data is loaded (you will see [this](https://i.imgur.com/ShKcuay.png) if it is not loaded). If that does not work, try factory reset.

### Why doesn't it work for me?
I don't know. Try factory reset. Otherwise, be sure to contact me and provide me the log/error from the JavaScript console, if there is any.
Post it [here](https://github.com/Revadike/SteamWebIntegration/issues).

### Can I suggest a feature?
Yes, absolutely! Post it [here](https://github.com/Revadike/SteamWebIntegration/issues).

### Can I contribute to the project?
Even better! Submit your Pull Requests [here](https://github.com/Revadike/SteamWebIntegration/pulls).

### My question isn't listed?
Try searching [GitHub issues](https://github.com/Revadike/SteamWebIntegration/issues) or the [SteamGifts topic](https://www.steamgifts.com/discussion/y9vVm/) for your answer.

## Changelog
**Later versions can be found [here](https://github.com/Revadike/SteamWebIntegration/releases)**

**Version 1.6**
 * Added support for trading cards icon.

**Version 1.5**
 * Added support for games that were removed or delisted on Steam.

**Version 1.3**
 * Implemented caching of data and added support for dynamically generated content.

**Version 1.2**
 * Prevented alerts from showing when in incognito mode

**Version 1.1**
 * Added support for agecheck links

**Version 1.0**
 * Initial release
