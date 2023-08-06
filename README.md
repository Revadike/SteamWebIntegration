
<!-- # Steam Web Integration -->

[![GitHub license](https://img.shields.io/github/license/Revadike/SteamWebIntegration?style=for-the-badge&logo=github)](https://github.com/Revadike/SteamWebIntegration/blob/master/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/Revadike/SteamWebIntegration?style=for-the-badge&logo=github)](https://github.com/Revadike/SteamWebIntegration/issues)
[![GitHub stars](https://img.shields.io/github/stars/Revadike/SteamWebIntegration?style=for-the-badge&logo=github)](https://github.com/Revadike/SteamWebIntegration/stargazers)
[![GitHub stable release date](https://img.shields.io/github/release-date/Revadike/SteamWebIntegration.svg?label=Released&maxAge=600&style=for-the-badge)](https://github.com/Revadike/SteamWebIntegration/releases/latest)
[![GitHub stable release version](https://img.shields.io/github/release/Revadike/SteamWebIntegration.svg?label=Stable&maxAge=600&style=for-the-badge)](https://github.com/Revadike/SteamWebIntegration/releases/latest)
[![Steam donate](https://img.shields.io/badge/Steam-donate-yellow.svg?logo=steam&style=for-the-badge)](https://steamcommunity.com/tradeoffer/new/?partner=82699538&token=V7DQVtra)


> Integrate your personal Steam information on the web, at your convenience!
> 

## Screenshot
![image](https://user-images.githubusercontent.com/4411977/221296248-1abfbc0a-bb3b-409f-bb97-639593e85379.png)

## Download
[![chrome](https://img.shields.io/chrome-web-store/users/bcjlaaocogjkkhbmjhlhonmpnngnlogn?label=chrome&style=for-the-badge&logo=googlechrome)](https://chrome.google.com/webstore/detail/steam-web-integration/bcjlaaocogjkkhbmjhlhonmpnngnlogn)
[![firefox](https://img.shields.io/amo/users/steam-web-integration?label=firefox&color=4c1&style=for-the-badge&logo=firefoxbrowser)](https://addons.mozilla.org/firefox/addon/steam-web-integration/)
 
## Sponsors
None at the moment. Consider [sponsoring me](https://github.com/sponsors/Revadike) and ask to be featured here! <3

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
 * Highly configurable

## Used Libraries
  * [JSColor](https://github.com/EastDesire/jscolor)
  * [FontAwesome](https://fontawesome.com/)

## FAQ

### Why does it not work?
Make sure you are logged in to steam with the right account in your web browser and visit [this page](http://store.steampowered.com/dynamicstore/userdata/) and refresh until you can see all your data is loaded (you will see [this](https://i.imgur.com/ShKcuay.png) if it is _not_ loaded). If that does not work, try factory reset.

### Why does it _still_ not work?
I don't know. Try factory reset. Otherwise, be sure to contact me and provide me the log/error from the extension, if there is any.
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
