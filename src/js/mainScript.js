import {localStorageService} from "./service/data/localStorageService.js";
import {Router} from "./router.js";
import {VuePluginManager} from "./vue/vuePluginManager";
import {MainVue} from "./vue/mainVue";

import './../css/gridlist.css';
import './../css/jquery.contextMenu.css';
import './../css/holy-grail.css';
import {loginService} from "./service/loginService";
import {urlParamService} from "./service/urlParamService";
import {constants} from "./util/constants";
import {modelUtil} from "./util/modelUtil";
import {keyboardShortcuts} from "./service/keyboardShortcuts";
//import {timingLogger} from "./service/timingLogger";

let SERVICE_WORKER_UPDATE_CHECK_INTERVAL = 1000 * 60 * 15; // 15 Minutes

function init() {
    let promises = [];
    log.warn('newVersion!')
    //timingLogger.initLogging();
    log.setLevel(log.levels.INFO);
    log.info('AsTeRICS Grid, release version: https://github.com/asterics/AsTeRICS-Grid/releases/tag/#ASTERICS_GRID_VERSION#');
    initServiceWorker();
    loginService.ping();
    VuePluginManager.init();
    keyboardShortcuts.init();
    let lastActiveUser = localStorageService.getLastActiveUser();
    let autologinUser = localStorageService.getAutologinUser();
    if (localStorageService.getUserMajorModelVersion(autologinUser) > modelUtil.getLatestModelVersion().major) {
        log.info(`data model version of user "${autologinUser}" is newer than version of running AsTeRICS Grid -> prevent autologin.`);
        autologinUser = null;
        localStorageService.setAutologinUser('');
    }
    log.info('autologin user: ' + autologinUser);
    if (urlParamService.isDemoMode()) {
        promises.push(loginService.registerOffline(constants.LOCAL_DEMO_USERNAME, constants.LOCAL_DEMO_USERNAME));
        localStorageService.setAutologinUser('');
    } else {
        promises.push(loginService.loginStoredUser(autologinUser, true));
    }
    Promise.all(promises).finally(() => {
        MainVue.init();
        let toMain = autologinUser || urlParamService.isDemoMode();
        let toLogin = lastActiveUser || localStorageService.getSavedUsers().length > 0;
        localStorageService.setLastActiveUser(autologinUser || lastActiveUser || '');
        let initHash = location.hash || (toMain ? '#main' : toLogin ? '#login' : '#welcome');
        if (!Router.isInitialized()) {
            Router.init('#injectView', initHash);
        }
    });
}
init();

function initServiceWorker() {
    if (!constants.IS_ENVIRONMENT_PROD) {
        log.warn('Not installing Service Worker because on development environment.')
        return;
    }
    if ('serviceWorker' in navigator) {
        if (window.loaded) {
            installServiceWorker();
        } else {
            // Use the window load event to keep the page load performant
            window.addEventListener('load', () => {
                installServiceWorker();
            });
        }
    }

    function installServiceWorker() {
        navigator.serviceWorker.register('./serviceWorker.js').then(reg => {
            let isUpdate = false;
            setInterval(() => {
                log.info('Check for serviceworker update...');
                reg.update();
            }, SERVICE_WORKER_UPDATE_CHECK_INTERVAL);
            reg.addEventListener('updatefound', function () {
                if (navigator.serviceWorker.controller) {
                    isUpdate = true;
                }
            });
            navigator.serviceWorker.addEventListener("message", (evt) => {
                if (isUpdate && evt.data && evt.data.activated) {
                    MainVue.setTooltipI18n("New version available! The next time you re-open AsTeRICS Grid you'll automatically use the updated version. // Neue Version verfügbar! Beim nächsten Start von AsTeRICS Grid verwenden Sie automatisch die neue Version.", {
                        closeOnNavigate: false,
                        actionLink: 'Update now // Jetzt aktualisieren',
                        actionLinkFn: () => {
                            window.location.reload();
                        },
                    })
                }
            });
        });
    }
}