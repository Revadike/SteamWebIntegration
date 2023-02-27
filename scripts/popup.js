function factoryReset() {
    console.log("[Steam Web Integration] Performing factory reset...");
    return chrome.storage.local.clear();
}

async function setSettings(newSettings) {
    let settings = await chrome.runtime.sendMessage({ "action": "getSettings" });
    settings = { ...settings, ...newSettings };
    await chrome.storage.local.set({ "swi_settings": settings });
    return true;
}

function showToast() {
    const toast = document.getElementById("snackbar");
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
}

function getSelectValues(select) {
    let result = [];
    let options = select && select.options;
    let opt;

    for (let i = 0, iLen = options.length; i < iLen; i++) {
        opt = options[i];

        if (opt.selected) {
            result.push(opt.value || opt.text);
        }
    }
    return result;
}

function onChange(elem) {
    const { name, value, type, checked } = elem;
    const newSettings = {};

    if (type === "checkbox") {
        newSettings[name] = Boolean(checked);
    } else if (type === "select-multiple") {
        newSettings[name] = getSelectValues(elem);
    } else {
        newSettings[name] = Number.isFinite(value) ? Number(value) : value;
    }

    setSettings(newSettings);
    showToast();
}

document.addEventListener("DOMContentLoaded", async() => {
    console.log("[Steam Web Integration] Popup loaded");

    const permissions = {
        "origins": ["https://store.steampowered.com/*", "http://*/*", "https://*/*"],
        // "permissions": ["storage", "unlimitedStorage", "contextMenus"],
    };

    let granted = await chrome.permissions.contains(permissions);
    if (!granted) {
        document.getElementById("setup-block").style.display = "block";
        document.getElementById("ready-block").style.display = "none";
        document.getElementById("setup").addEventListener("click", () => {
            chrome.permissions.request(permissions, (granted) => {
                if (granted) {
                    location.reload();
                } else {
                    // eslint-disable-next-line no-alert
                    alert("You must grant the permissions to use this extension.");
                }
            });
            window.close();
        });
        return;
    }

    document.getElementById("setup-block").style.display = "none";
    document.getElementById("ready-block").style.display = "block";
    let settings = await chrome.runtime.sendMessage({ "action": "getSettings" });
    document.getElementById("blackList").placeholder = "example.com\nftp://\n/bundle/";
    for (let node of document.getElementsByClassName("setting")) {
        const { name } = node;
        const value = settings[name];

        if (typeof value === "boolean") {
            node.checked = value;
        } else if (Array.isArray(value)) {
            for (let option of node.options) {
                option.selected = value.includes(option.value);
            }
        } else {
            node.value = value;
        }

        node.addEventListener("change", () => onChange(node));
    }

    document.getElementById("run").addEventListener("click", () => {
        chrome.runtime.sendMessage({ "action": "runSWI" });
    });

    document.getElementById("reload").addEventListener("click", () => {
        chrome.runtime.sendMessage({ "action": "reloadSWI" });
    });

    document.getElementById("clear").addEventListener("click", () => {
        chrome.runtime.sendMessage({ "action": "clearSWI" });
    });

    document.getElementById("factoryReset").addEventListener("click", async() => {
        // eslint-disable-next-line no-alert
        if (confirm("Are you sure you want to reset all settings and cached data?")) {
            await factoryReset();
            location.reload();
        }
    });
});
