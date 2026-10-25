// ==UserScript==
// @name         MR哔哩哔哩助手-自动宽屏模式|自定义布局|智能连播|打造属于自己的B站
// @namespace    https://github.com/miaonai
// @version      1.1.13
// @description  自动宽屏模式|自定义布局|智能连播...更多功能等你体验, 打造属于自己的B站~
// @author       Mort Rex, MiaoNai
// @run-at       document-start
// @match        *://*.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @noframes
// @license      MIT
// @downloadURL https://raw.githubusercontent.com/miaonai/MR-bilibili-helper/main/MR%E5%93%94%E5%93%A9%E5%93%94%E5%93%A9%E5%8A%A9%E6%89%8B.user.js
// @updateURL   https://raw.githubusercontent.com/miaonai/MR-bilibili-helper/main/MR%E5%93%94%E5%93%A9%E5%93%94%E5%93%A9%E5%8A%A9%E6%89%8B.user.js
// ==/UserScript==

(function () {
    'use strict';

    var nativeSetTimeout = window.setTimeout.bind(window);
    var nativeClearTimeout = window.clearTimeout.bind(window);
    var nativeSetInterval = window.setInterval.bind(window);
    var nativeClearInterval = window.clearInterval.bind(window);

    var ResourceManager = (function () {
        var timers = new Set();
        var intervals = new Set();
        return {
            setTimeout: function (fn, d) {
                var id = nativeSetTimeout(function () { timers.delete(id); fn(); }, d);
                timers.add(id);
                return id;
            },
            clearTimeout: function (id) { nativeClearTimeout(id); timers.delete(id); },
            setInterval: function (fn, d) {
                var id = nativeSetInterval(fn, d);
                intervals.add(id);
                return id;
            },
            clearInterval: function (id) { nativeClearInterval(id); intervals.delete(id); },
            clearAll: function () {
                timers.forEach(function (id) { nativeClearTimeout(id); });
                intervals.forEach(function (id) { nativeClearInterval(id); });
                timers.clear();
                intervals.clear();
            }
        };
    })();

    var setTimeout = function (fn, d) { return ResourceManager.setTimeout(fn, d); };
    var setInterval = function (fn, d) { return ResourceManager.setInterval(fn, d); };
    var clearTimeout = function (id) { return ResourceManager.clearTimeout(id); };
    var clearInterval = function (id) { return ResourceManager.clearInterval(id); };

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    function waitForElement(selector, callback, opts) {
        opts = opts || {};
        var root = opts.root || document;
        var timeout = opts.timeout || 15000;
        var existing = root.querySelector(selector);
        if (existing) return callback(existing);

        var done = false;
        var observer = new MutationObserver(function () {
            if (done) return;
            var el = root.querySelector(selector);
            if (el) { done = true; observer.disconnect(); ResourceManager.clearTimeout(tid); callback(el); }
        });
        observer.observe(root === document ? document.documentElement : root, { childList: true, subtree: true });
        var tid = ResourceManager.setTimeout(function () {
            if (done) return;
            done = true;
            observer.disconnect();
            console.warn('[MR助手] waitForElement 超时: ' + selector);
        }, timeout);
    }

    function pollUntil(cond, cb, opts) {
        opts = opts || {};
        var interval = opts.interval || 200;
        var maxMs = opts.maxMs || 15000;
        var start = Date.now();
        var id = ResourceManager.setInterval(function () {
            if (cond()) { ResourceManager.clearInterval(id); cb(); }
            else if (Date.now() - start > maxMs) {
                ResourceManager.clearInterval(id);
                console.warn('[MR助手] pollUntil 超时: ' + (opts.label || '未命名'));
            }
        }, interval);
        return id;
    }

    var notificationScriptName = 'MR哔哩哔哩助手';
    var notificationNotification = '通知';
    var notificationCheck = '检测';
    var notificationWarning = '警告';
    var notificationError = '错误';

    var loadReady = false;
    var isMRMenuMoving = false;
    var isMRMenuMovingX = 0;
    var isMRMenuMovingY = 0;

    var autoWidescreenBtn = '';
    var autoWidescreenisWidescreenClass = '';

    var webStatus = 0;
    var webStatusUnknowPage = 999;
    var webStatusNotShow = 999999;
    var webStatusLog = '';

    function detectWebStatus() {
        var url = window.location.href;
        if (url.match('bilibili.com/video/')) { webStatusLog = '视频'; return 0; }
        if (url.match('bilibili.com/bangumi/')) { webStatusLog = '影视'; return 1; }
        if (url.match('bilibili.com/list/')) { webStatusLog = '列表'; return 2; }
        if (url.match('space.bilibili.com')) { webStatusLog = '空间'; return 3; }
        if (url.match('search.bilibili.com')) { webStatusLog = '搜索'; return 4; }
        if (url.match('www.bilibili.com')) { webStatusLog = '主页'; return 5; }
        if (url.match('message.bilibili.com') && !url.match('message.bilibili.com/pages/nav')) { webStatusLog = '信息'; return 6; }
        if (url.match('account.bilibili.com')) { webStatusLog = '个人中心'; return 7; }
        if (url.match('bilibili.com/watchlater')) { webStatusLog = '稍后再看'; return 8; }
        if (url.match('t.bilibili.com')) { webStatusLog = '动态'; return 9; }
        if (url.match('member.bilibili.com')) { webStatusLog = '创作中心'; return 999; }
        if (url.match('message.bilibili.com/pages/nav')) { webStatusLog = '页面内信息'; return 999999; }
        webStatusLog = '未知页面'; return 999;
    }
    webStatus = detectWebStatus();
    if (webStatus == webStatusUnknowPage) console.log('[' + notificationScriptName + '-' + notificationWarning + '] ' + webStatusLog);
    else if (webStatus != webStatusNotShow) console.log('[' + notificationScriptName + '-' + notificationNotification + '] 当前是 [' + webStatusLog + '] 页面');

    function initGM(key, v) { if (GM_getValue(key) == null) GM_setValue(key, v); }
    initGM('MRMenuSwitch', 1); initGM('MRMenuReadme', 1); initGM('MRPlayerMode', 2);
    initGM('MRMenuMoveNavigationBar', 1); initGM('MRMenuHideFeedbackBtn', 1);
    initGM('MRMenuDownLayoutPadding', 1); initGM('MRMenuDownLayoutSearchBarFull', 1);
    initGM('MRMenuPutSendingBarInPlayer', 1); initGM('MRMenuHideVideoInfo', 1);
    initGM('MRMenuDisplayEplist', 1); initGM('MRMenuDisplayTitle', 1);
    initGM('MRMenuHideFollowBtn', 0); initGM('MRMenuMoveTitleAndUpinfo', 1);
    initGM('MRMenuBetterToolTip', 0); initGM('MRMenuHideProgressArea', 1);
    initGM('MRMenuHideNavigationBarTag', '00111111111');
    initGM('MRMenuTransparent', 1); initGM('MRMenuSmartNextPlay', 1);
    initGM('MRMenuMoveWindowToTop', 0); initGM('MRMenuRemoveWidescreenBlack', 0);
    initGM('MRMenuRemoveKeyword', 1); initGM('MRMenuRemoveUselessComment', 1);
    initGM('MRMenuMoreVideoSpeed', 1); initGM('MRMenuWatchLaterReplaceURL', 1);
    initGM('MRMenuEscQuitViewImage', 1); initGM('MRMenuFixPIPDelay', 1);
    initGM('MRMenuAlwaysOpenSubtitle', 0); initGM('MRMenuAlwaysDisableDnmaku', '001');

    var MRMenuElement, MRMenuBackground, MRMenuStyle;

    function buildSwitchHTML(id, text) {
        return '<div class="MRMenuOption" id="' + id + '">' +
            '<label class="MRMenuText" id="' + id + 'Text">' + text + '</label>' +
            '<label class="MRMenuSwitch" id="' + id + 'Switch">' +
            '<input type="checkbox" id="' + id + 'Checkbox">' +
            '<div class="MRMenuSlider" id="' + id + 'Slider"></div>' +
            '</label></div>';
    }

    function buildMenuHTML() {
        var switchData = {
            playerMode: [['MRMenuNormal', '默认模式'], ['MRMenuAutoWidescreen', '自动宽屏模式'], ['MRMenuFullscreen', '网页全屏模式']],
            customLayout: [
                ['MRMenuMoveNavigationBar', '移动导航栏到视频下方'], ['MRMenuHideFeedbackBtn', '隐藏新版反馈和回到旧版按钮'],
                ['MRMenuDownLayoutPadding', '调整下方左右边距'], ['MRMenuSearchBarFull', '导航栏搜索框长度占满'],
                ['MRMenuPutSendingBarInPlayer', '将弹幕栏整合到播放器内'], ['MRMenuHideVideoInfo', '隐藏观看人数和弹幕装填信息'],
                ['MRMenuDisplayEplist', '播放器内显示选集按钮'], ['MRMenuDisplayTitle', '播放器内显示标题'],
                ['MRMenuHideFollowBtn', '隐藏播放器内关注按钮'], ['MRMenuMoveTitleAndUpinfo', '把标题和头像移到视频下方'],
                ['MRMenuBetterToolTip', '优化工具提示弹窗'], ['MRMenuHideProgressArea', '隐藏视频底部蓝条']
            ],
            functions: [
                ['MRMenuTransparent', '菜单半透明'], ['MRMenuSmartNextPlay', '智能连播 (多集/分P连播, 单集不连播)'],
                ['MRMenuMoveWindowToTop', '播放器加载完毕后移动窗口到顶部'], ['MRMenuRemoveWidescreenBlack', '去除宽屏模式左右黑边 (竖版视频不生效)'],
                ['MRMenuRemoveKeyword', '去除评论区蓝色关键字'], ['MRMenuRemoveUselessComment', '去除评论区只有@人的无用评论'],
                ['MRMenuMoreVideoSpeed', '更多倍速'], ['MRMenuWatchLaterReplaceURL', '稍后再看页面替换网址'],
                ['MRMenuEscQuitViewImage', '按ESC退出图片预览'], ['MRMenuFixPIPDelay', '修复视频小窗口延迟'],
                ['MRMenuAlwaysOpenSubtitle', '总是开启字幕']
            ]
        };
        var navTagNames = ['图标', '首页', '番剧', '直播', '游戏', '会员购', '漫画', '赛事', '活动广告', '下载客户端', '右侧间隔'];
        var navTagHTML = navTagNames.map(function (n, i) { return buildSwitchHTML('MRMenuHideNavigationBarTag' + i, n); }).join('');
        var dnmakuHTML = ['开启功能', '总是开启', '总是关闭'].map(function (n, i) { return buildSwitchHTML('MRMenuAlwaysDisableDnmaku' + i, n); }).join('');

        function section(id, title, switches) {
            return '<div class="MRMenuOptionParent" id="' + id + '">' +
                '<label class="MRMenuTitleText" id="' + id + 'Text">' + title + '</label>' +
                '<div class="MRMenuSplit"></div>' +
                switches.map(function (s) { return buildSwitchHTML(s[0], s[1]); }).join('') +
                '</div>';
        }

        return '<div id="MRMenuReadme" style="margin: var(--defaultMargin); width: 100%; height: auto; display: none; flex-wrap: wrap;">' +
            '<label class="MRMenuText" id="MRMenuReadmeText" style="margin: var(--defaultMargin); width: 100%; height: auto; line-height: 30px; text-align: left;">' +
            'MR哔哩哔哩助手首次使用指南:<br>0. 这段文字下次打开就会消失啦<br>1. 菜单可以向下滚动<br>2. 按住菜单任意位置可以拖拽菜单<br>3. 脚本不适配旧版哔哩哔哩, 请切换到新版界面</label>' +
            '<div class="MRMenuSplit"></div></div>' +
            '<label class="MRMenuText" id="MRMenuTitle" style="margin: var(--defaultMargin); width: 100%; height: 30px; line-height: 30px;">' +
            'MR哔哩哔哩助手菜单<span id="MRMenuStatus" style="color: var(--closeBtnHoverBg) !important;"> (未激活, 请等待页面加载完毕)</span></label>' +
            '<button type="button" id="MRMenuCloseBtn">关闭</button>' +
            section('MRMenuPlayerMode', '播放器模式', switchData.playerMode) +
            section('MRMenuCustomLayout', '自定义布局', switchData.customLayout) +
            '<div class="MRMenuOptionParent" id="MRMenuHideNavigationBarTag"><label class="MRMenuTitleText" id="MRMenuHideNavigationBarTagText">隐藏导航栏标签</label>' +
            '<div class="MRMenuSplit"></div><div class="MRMultipleOptionsParent" id="MRMenuHideNavigationBarTagParent">' + navTagHTML + '</div></div>' +
            section('MRMenuFunctions', '实用功能与工具', switchData.functions) +
            '<div class="MRMenuOptionParent" id="MRMenuAlwaysDisableDnmaku"><label class="MRMenuTitleText" id="MRMenuAlwaysDisableDnmakuText">总是开启或关闭弹幕</label>' +
            '<div class="MRMenuSplit"></div><div class="MRMultipleOptionsParent" id="MRMenuAlwaysDisableDnmakuParent">' + dnmakuHTML + '</div></div>';
    }

    function buildMenuCSS() {
        return [
            '@media(prefers-color-scheme: dark){:root{--bg:rgba(30,30,30,1);--bg2:rgba(45,45,45,1);--textColor:rgba(255,255,255,1);--closeBtnActiveTextColor:rgba(205,205,205,1);--closeBtnHoverBg:rgba(230,50,50,1);--closeBtnActiveBg:rgba(130,30,30,1);--sliderBg:rgba(25,25,25,1);--sliderBgChecked:rgba(30,150,245,1);--sliderBtn:rgba(255,255,255,1);--border:rgba(0,0,0,0.3);--border2:rgba(40,40,40,1);--split:rgba(30,30,30,1)}}',
            '@media(prefers-color-scheme: light){:root{--bg:rgba(240,240,240,1);--bg2:rgba(250,250,250,1);--textColor:rgba(0,0,0,1);--closeBtnActiveTextColor:rgba(60,60,60,1);--closeBtnHoverBg:rgba(230,50,50,1);--closeBtnActiveBg:rgba(230,150,150,1);--sliderBg:rgba(205,205,205,1);--sliderBgChecked:rgba(30,150,245,1);--sliderBtn:rgba(255,255,255,1);--border:rgba(0,0,0,0.3);--border2:rgba(220,220,220,1);--split:rgba(230,230,230,1)}}',
            ':root{--defaultMargin:10px 10px 0px 10px;--defaultMargin2:0px 0px 0px 10px}',
            '.MRMenuOptionParent{margin:var(--defaultMargin);justify-content:space-between;background-color:var(--bg2)!important;box-shadow:rgba(0,0,0,0.1) 0px 0px 0px 1px!important;border-radius:6px;width:100%;height:auto;padding:0px 10px 10px 0px;pointer-events:none;display:flex;flex-wrap:wrap;user-select:none}',
            '.MRMenuTitleText{margin:var(--defaultMargin);font-size:16px;text-align:center;user-select:none;width:100%;height:auto;line-height:28px;color:var(--textColor)!important}',
            '.MRMenuText{margin:var(--defaultMargin2);font-size:16px;text-align:center;user-select:none;width:auto;height:auto;line-height:28px;color:var(--textColor)!important}',
            '.MRMenuOption{margin:var(--defaultMargin);display:flex;flex-wrap:wrap;user-select:none}',
            '.MRMenuSwitch{margin:var(--defaultMargin2);position:relative;display:inline-block;width:50px;height:28px}',
            '.MRMenuSlider{border-radius:26px;position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:var(--sliderBg)!important;transition:.2s}',
            '.MRMultipleOptionsParent{display:flex;flex-wrap:wrap;justify-content:space-between}',
            '.MRMenuSwitch input{display:none}',
            '.MRMenuOptionParent[mr_is_loaded=true]{pointer-events:unset}',
            '.MRMenuSlider:before{border-radius:50%;position:absolute;content:"";height:24px;width:24px;left:2px;bottom:2px;background-color:var(--sliderBtn)!important;transition:.2s}',
            'input:checked+.MRMenuSlider[mr_disable=true]{background-color:var(--sliderBg)!important}',
            '.MRMenuSlider[mr_disable=true]:before{opacity:0.4}',
            'input:checked+.MRMenuSlider{background-color:var(--sliderBgChecked)!important}',
            'input:checked+.MRMenuSlider:before{transform:translateX(22px)}',
            '.MRMenuSplit{margin:10px 10px 0px 20px;background-color:var(--split)!important;border-radius:2px;width:100%;height:2px}',
            '#MRMenuCloseBtn{width:52px;height:30px;margin:-30px 0px 0px calc(100% - 62px);font-size:16px;text-align:center;line-height:30px;box-sizing:border-box;border:0;border-radius:6px;background-color:var(--bg2);color:var(--textColor);outline:none;user-select:none;box-shadow:rgb(0 0 0 / 10%) 0px 0px 0px 1px!important;transition:.1s;padding:0px 0px 0px 1px}',
            '#MRMenuCloseBtn:hover{color:rgba(255,255,255,1);background-color:var(--closeBtnHoverBg)}',
            '#MRMenuCloseBtn:active{color:rgba(255,255,255,1);background-color:var(--closeBtnActiveBg)}',
            '[mr_always_display=true]{display:block!important}',
            '.bpx-player-sending-area[mr_inside_player=true]:before,.bilibili-player-video-bottom-area[mr_inside_player=true]:before{display:none!important}',
            '[mr_inside_player=true]::-webkit-input-placeholder{color:hsla(0,0%,100%,0.6)!important}',
            '[mr_show_eplist=true]{width:36px;visibility:visible}',
            '#viewbox_report[mr_layout=true],.video-info-container[mr_layout=true]{height:86px;border-bottom:1px solid var(--line_regular);padding:16px 0px 12px 0px}',
            '.up-panel-container[mr_layout=true]{border-bottom:1px solid var(--line_regular);padding:16px 0px 10px 0px;margin:0px}',
            '.up-info-container[mr_layout=true]{height:48px}',
            '.upinfo-btn-panel[mr_layout=true]{float:right;margin:-48px 10px 0px 0px}',
            '.old-charge-btn[mr_layout=true],.new-charge-btn[mr_layout=true],.follow-btn[mr_layout=true],.not-follow[mr_layout=true]{height:48px!important}',
            '.new-charge-btn[mr_layout=true]{margin:0px 12px 0px 0px}',
            '.follow-btn[mr_layout=true],.not-follow[mr_layout=true]{width:130px!important;padding:0px 8px!important}',
            '.up-name[mr_layout=true],.up-detail-top[mr_layout=true]{margin:4px 0px 0px 0px}',
            '.has-pendant[mr_layout=true]{margin:-16px 0px -10px -8px}',
            '.mmembers-info-container[mr_layout=true],.members-info-container[mr_layout=true]{border-bottom:1px solid var(--line_regular)}',
            '.playlist-container--right[mr_layout=true],.right-container[mr_layout=true]{margin-top:16px}',
            'body *::-webkit-scrollbar{width:0px!important;height:0px!important}',
            '#bilibili-player-wrap[mr_fullscreen=true]{width:auto!important;height:auto!important;padding:0!important;z-index:50!important;position:relative!important}',

            '.bpx-player-shadow-progress-area[mr_hide_progress_area=true] * { display: none !important; }',

            '.left-container #viewbox_report[mr_layout=true]{height:auto!important;padding:16px 0 12px!important;margin-bottom:0!important;border-bottom:1px solid var(--line_regular)!important}',
            '.left-container .up-panel-container[mr_layout=true]{display:flex!important;flex-direction:row!important;justify-content:space-between!important;align-items:center!important;width:100%!important;padding:16px 0!important;margin:0!important;border-bottom:1px solid var(--line_regular)!important;height:auto!important;box-sizing:border-box!important}',
            '.left-container .up-panel-container[mr_layout=true] .up-info-container{display:flex!important;flex-direction:row!important;align-items:center!important;flex:1!important;margin:0!important;height:auto!important;width:auto!important;min-width:0!important}',
            '.left-container .up-panel-container[mr_layout=true] .members-info-container,.left-container .up-panel-container[mr_layout=true] .mmembers-info-container{width:100%!important;min-width:0!important;padding-top:0!important}',
            '.left-container .up-panel-container[mr_layout=true] .up-info--left{margin-right:16px!important;flex-shrink:0!important;display:block!important}',
            '.left-container .up-panel-container[mr_layout=true] .up-info--right{display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:flex-start!important;flex:1!important;height:auto!important;margin:0!important;padding:0!important;overflow:hidden!important}',
            '.left-container .up-panel-container[mr_layout=true] .up-name{font-size:16px!important;line-height:20px!important;display:block!important}',
            '.left-container .up-panel-container[mr_layout=true] .up-description{margin:0!important;font-size:12px!important;line-height:18px!important;display:block!important;white-space:nowrap!important;text-overflow:ellipsis!important;overflow:hidden!important}',
            '.left-container .up-panel-container[mr_layout=true] .up-info__btn-panel, .left-container .up-panel-container[mr_layout=true] .upinfo-btn-panel{display:flex!important;flex-direction:row!important;align-items:center!important;flex-shrink:0!important;margin-left:auto!important;float:none!important;position:static!important;padding:0!important;height:auto!important;background:none!important}',
            '.left-container .up-panel-container[mr_layout=true] .default-btn{height:38px!important;line-height:38px!important;margin:0 0 0 12px!important;border-radius:8px!important;padding:0 20px!important;font-size:14px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;float:none!important}',
            '.left-container .up-panel-container[mr_layout=true] .follow-btn, .left-container .up-panel-container[mr_layout=true] .not-follow{min-width:100px!important}',

            'ul.left-entry{gap:0!important;column-gap:0!important;}',
            'ul.left-entry>li{margin-right:0!important;margin-left:0!important;padding-right:0!important;padding-left:0!important;}',
            'ul.left-entry>li[style*="display: none"]{width:0!important;min-width:0!important;overflow:hidden!important;padding:0!important;margin:0!important;border:none!important;}'
        ].join('\n');
    }

    if (webStatus != webStatusUnknowPage && webStatus != webStatusNotShow) {
        MRMenuElement = document.createElement('div');
        MRMenuElement.setAttribute('id', 'MRMenu');
        MRMenuElement.style.cssText = 'transition:.2s;z-index:99999;position:fixed;' +
            (GM_getValue('MRMenuSwitch') == 0 ? 'opacity:0;pointer-events:none;' : 'opacity:' + GM_getValue('MRMenuTransparent') + ';');

        MRMenuBackground = document.createElement('div');
        MRMenuBackground.setAttribute('id', 'MRMenuBackground');
        MRMenuBackground.style.cssText = 'display:flex;overflow:auto;flex-wrap:wrap;position:fixed;box-shadow:var(--border) 0px 0px 0px 1.2px !important;width:600px;height:auto;background-color:var(--bg) !important;z-index:9999999;border-radius:8px;left:50%;top:50%;transform:translate(-50%,-50%);padding:0px 0px 8px 0px;max-height:592px;max-width:600px;box-sizing:unset;scrollbar-width:none;';
        MRMenuBackground.innerHTML = buildMenuHTML();

        MRMenuStyle = document.createElement('style');
        MRMenuStyle.innerHTML = buildMenuCSS();

        MRMenuElement.appendChild(MRMenuBackground);
        MRMenuElement.appendChild(MRMenuStyle);

        window.MRMenuElement = MRMenuElement;
        window.unsafeWindow = window.unsafeWindow || window;
        try { unsafeWindow.MRMenuElement = MRMenuElement; } catch (e) { }

        function menuClick() {
            var menu = window.MRMenuElement;
            if (!menu) { console.warn('[MR助手] 菜单未初始化'); return; }
            if (GM_getValue('MRMenuSwitch') == 0) {
                GM_setValue('MRMenuSwitch', 1);
                menu.style.cssText += 'pointer-events: all; opacity: ' + GM_getValue('MRMenuTransparent') + ';';
            } else {
                GM_setValue('MRMenuSwitch', 0);
                menu.style.cssText += 'pointer-events: none; opacity: 0;';
            }
        }
        GM_registerMenuCommand('菜单', menuClick);

        function initPage() {
            loadReadyFunction();

            if (GM_getValue('MRPlayerMode') == 0) { autoWidescreen(); }
            else if (GM_getValue('MRPlayerMode') == 1) { autoWidescreen(); }
            else if (GM_getValue('MRPlayerMode') == 2) { fullscreen(); }

            if (GM_getValue('MRMenuHideFeedbackBtn') == 1) hideFeedbackBtn();
            if (GM_getValue('MRMenuHideVideoInfo') == 1) hideVideoInfo();
            if (GM_getValue('MRMenuDisplayEplist') == 1) displayEplist();
            if (GM_getValue('MRMenuHideFollowBtn') == 1) hideFollowBtn();
            if (GM_getValue('MRMenuMoveTitleAndUpinfo') == 1) moveTitleAndUpinfo();

            if (GM_getValue('MRMenuDownLayoutSearchBarFull') == 1) searchBarFull();
            if (GM_getValue('MRMenuDisplayTitle') == 1) displayTitle();
            if (GM_getValue('MRMenuBetterToolTip') == 1) betterToolTip();
            if (GM_getValue('MRMenuHideProgressArea') == 1) hideProgressArea();
            if (GM_getValue('MRMenuRemoveWidescreenBlack') == 1) removeWidescreenBlack();
            if (GM_getValue('MRMenuRemoveKeyword') == 1) removeKeyword();
            if (GM_getValue('MRMenuRemoveUselessComment') == 1) removeUselessComment();
            if (GM_getValue('MRMenuMoreVideoSpeed') == 1) moreVideoSpeed();
            if (GM_getValue('MRMenuWatchLaterReplaceURL') == 1) watchLaterReplaceURL();
            if (GM_getValue('MRMenuFixPIPDelay') == 1) fixPIPDelay();
            if (GM_getValue('MRMenuAlwaysOpenSubtitle') == 1) alwaysOpenSubtitle();
            alwaysDisableDnmaku();
            hideNavigationBarTag();

            smartNextPlay();

            if (webStatus == 0 || webStatus == 1 || webStatus == 2) {
                (function widescreenBtnCheck() {
                    var btn = document.getElementsByClassName('bpx-player-ctrl-wide')[0];
                    if (btn) {
                        btn.addEventListener('click', function () {
                            if (GM_getValue('MRMenuMoveWindowToTop') == 1) moveWindowToTop();
                        });
                    } else {
                        setTimeout(widescreenBtnCheck, 200);
                    }
                })();
            }
        }

        initPage();

        var lastUrl = location.href;
        var routeCheckPending = false;
        new MutationObserver(function () {
            if (routeCheckPending) return;
            if (location.href !== lastUrl) {
                routeCheckPending = true;
                requestAnimationFrame(function () {
                    routeCheckPending = false;
                    if (location.href !== lastUrl) {
                        lastUrl = location.href;
                        onRouteChange();
                    }
                });
            }
        }).observe(document.documentElement, { childList: true, subtree: true });

        function onRouteChange() {
            ResourceManager.clearAll();
            loadReady = false;
            webStatus = detectWebStatus();
            console.log('[' + notificationScriptName + '-' + notificationNotification + '] SPA 路由变化 → ' + webStatusLog + '，重新初始化');
            initPage();
        }

        window.addEventListener('pagehide', function () { ResourceManager.clearAll(); });
        window.addEventListener('beforeunload', function () { ResourceManager.clearAll(); });

        (function afterBody() {
            if (document.body) {
                document.body.insertBefore(MRMenuElement, document.body.children[0]);
                if (loadReady) { var s = document.getElementById('MRMenuStatus'); if (s) s.textContent = ''; }
                console.log('[' + notificationScriptName + '-' + notificationNotification + '] MR菜单创建完毕');
                bindMenuDrag();
                afterBodyFunction();
                btnFunction();
            } else {
                setTimeout(afterBody, 20);
            }
        })();

        function bindMenuDrag() {
            var bg = document.getElementById('MRMenuBackground');
            bg.addEventListener('mousedown', function (e) {
                isMRMenuMovingX = e.pageX - bg.offsetLeft;
                isMRMenuMovingY = e.pageY - bg.offsetTop;
                isMRMenuMoving = true;
            });
            window.addEventListener('mouseup', function () { isMRMenuMoving = false; });
            window.addEventListener('blur', function () { isMRMenuMoving = false; });
            window.addEventListener('mousemove', function (e) {
                if (isMRMenuMoving) {
                    bg.style.left = e.pageX - isMRMenuMovingX + 'px';
                    bg.style.top = e.pageY - isMRMenuMovingY + 'px';
                }
            });
        }

        function afterBodyFunction() {
            if (GM_getValue('MRMenuReadme') == 1) {
                GM_setValue('MRMenuReadme', 0);
                var rm = document.getElementById('MRMenuReadme');
                if (rm) rm.style.display = 'flex';
            }

            var mode = GM_getValue('MRPlayerMode');
            if (mode == 0) {
                document.getElementById('MRMenuNormalCheckbox').checked = true;
                document.getElementById('MRMenuNormalSwitch').style.pointerEvents = 'none';
            } else if (mode == 1) {
                document.getElementById('MRMenuAutoWidescreenCheckbox').checked = true;
                document.getElementById('MRMenuAutoWidescreenSwitch').style.pointerEvents = 'none';
            } else if (mode == 2) {
                document.getElementById('MRMenuFullscreenCheckbox').checked = true;
                document.getElementById('MRMenuFullscreenSwitch').style.pointerEvents = 'none';
            }
            if (mode != 2) {
                disableBtn(document.getElementById('MRMenuMoveNavigationBarSwitch'));
                disableBtn(document.getElementById('MRMenuDownLayoutPaddingSwitch'));
                disableBtn(document.getElementById('MRMenuPutSendingBarInPlayerSwitch'));
            }

            var simpleToggles = [
                'MRMenuMoveNavigationBar', 'MRMenuHideFeedbackBtn', 'MRMenuDownLayoutPadding',
                'MRMenuDownLayoutSearchBarFull', 'MRMenuPutSendingBarInPlayer', 'MRMenuHideVideoInfo',
                'MRMenuDisplayEplist', 'MRMenuDisplayTitle', 'MRMenuHideFollowBtn',
                'MRMenuMoveTitleAndUpinfo', 'MRMenuBetterToolTip', 'MRMenuHideProgressArea'
            ];
            simpleToggles.forEach(function (k) {
                if (GM_getValue(k) == 1) { var el = document.getElementById(k + 'Checkbox'); if (el) el.checked = true; }
            });

            var navConf = GM_getValue('MRMenuHideNavigationBarTag').split('');
            while (navConf.length < 11) navConf.push('0');
            GM_setValue('MRMenuHideNavigationBarTag', navConf.join(''));

            navConf.forEach(function (v, i) {
                if (v == '1') { var el = document.getElementById('MRMenuHideNavigationBarTag' + i + 'Checkbox'); if (el) el.checked = true; }
            });

            if (GM_getValue('MRMenuTransparent') != 1) { var el = document.getElementById('MRMenuTransparentCheckbox'); if (el) el.checked = true; }
            if (GM_getValue('MRMenuSmartNextPlay') == 1) { var el = document.getElementById('MRMenuSmartNextPlayCheckbox'); if (el) el.checked = true; }
            if (GM_getValue('MRMenuMoveWindowToTop') == 1) {
                var el = document.getElementById('MRMenuMoveWindowToTopCheckbox'); if (el) el.checked = true;
                moveWindowToTop();
            }
            if (GM_getValue('MRMenuRemoveWidescreenBlack') == 1) { var el = document.getElementById('MRMenuRemoveWidescreenBlackCheckbox'); if (el) el.checked = true; }
            if (GM_getValue('MRMenuRemoveKeyword') == 1) { var el = document.getElementById('MRMenuRemoveKeywordCheckbox'); if (el) el.checked = true; }
            if (GM_getValue('MRMenuRemoveUselessComment') == 1) { var el = document.getElementById('MRMenuRemoveUselessCommentCheckbox'); if (el) el.checked = true; }
            if (GM_getValue('MRMenuMoreVideoSpeed') == 1) { var el = document.getElementById('MRMenuMoreVideoSpeedCheckbox'); if (el) el.checked = true; }
            if (GM_getValue('MRMenuWatchLaterReplaceURL') == 1) { var el = document.getElementById('MRMenuWatchLaterReplaceURLCheckbox'); if (el) el.checked = true; }
            if (GM_getValue('MRMenuEscQuitViewImage') == 1) { var el = document.getElementById('MRMenuEscQuitViewImageCheckbox'); if (el) el.checked = true; }
            if (GM_getValue('MRMenuFixPIPDelay') == 1) { var el = document.getElementById('MRMenuFixPIPDelayCheckbox'); if (el) el.checked = true; }
            if (GM_getValue('MRMenuAlwaysOpenSubtitle') == 1) { var el = document.getElementById('MRMenuAlwaysOpenSubtitleCheckbox'); if (el) el.checked = true; }

            GM_getValue('MRMenuAlwaysDisableDnmaku').split('').forEach(function (v, i) {
                if (v == '1') { var el = document.getElementById('MRMenuAlwaysDisableDnmaku' + i + 'Checkbox'); if (el) el.checked = true; }
                if (GM_getValue('MRMenuAlwaysDisableDnmaku').split('')[0] == 0 && i != 0) {
                    disableBtn(document.getElementById('MRMenuAlwaysDisableDnmaku' + i + 'Switch'));
                }
            });
        }

        function btnFunction() {
            document.getElementById('MRMenuCloseBtn').addEventListener('click', function () {
                GM_setValue('MRMenuSwitch', 0);
                MRMenuElement.style.cssText += 'pointer-events: none; opacity: 0;';
                var rm = document.getElementById('MRMenuReadme');
                if (rm && rm.style.display == 'flex') rm.style.display = 'none';
            });

            document.getElementById('MRMenuNormalSlider').addEventListener('click', function () {
                if (GM_getValue('MRPlayerMode') == 0) return;
                var prev = GM_getValue('MRPlayerMode');
                GM_setValue('MRPlayerMode', 0);
                if (prev == 1) autoWidescreen(); else if (prev == 2) { fullscreen(); autoWidescreen(); }
                document.getElementById('MRMenuAutoWidescreenCheckbox').checked = false;
                document.getElementById('MRMenuFullscreenCheckbox').checked = false;
                document.getElementById('MRMenuNormalSwitch').style.pointerEvents = 'none';
                document.getElementById('MRMenuAutoWidescreenSwitch').style.pointerEvents = '';
                document.getElementById('MRMenuFullscreenSwitch').style.pointerEvents = '';
                disableBtn(document.getElementById('MRMenuMoveNavigationBarSwitch'));
                disableBtn(document.getElementById('MRMenuDownLayoutPaddingSwitch'));
                disableBtn(document.getElementById('MRMenuPutSendingBarInPlayerSwitch'));
                if (GM_getValue('MRMenuMoveWindowToTop') == 1) moveWindowToTop();
                moveTitleAndUpinfo();
            });
            document.getElementById('MRMenuAutoWidescreenSlider').addEventListener('click', function () {
                if (GM_getValue('MRPlayerMode') == 1) return;
                var prev = GM_getValue('MRPlayerMode');
                GM_setValue('MRPlayerMode', 1);
                if (prev == 2) fullscreen();
                document.getElementById('MRMenuNormalCheckbox').checked = false;
                document.getElementById('MRMenuFullscreenCheckbox').checked = false;
                autoWidescreen();
                document.getElementById('MRMenuNormalSwitch').style.pointerEvents = '';
                document.getElementById('MRMenuAutoWidescreenSwitch').style.pointerEvents = 'none';
                document.getElementById('MRMenuFullscreenSwitch').style.pointerEvents = '';
                disableBtn(document.getElementById('MRMenuMoveNavigationBarSwitch'));
                disableBtn(document.getElementById('MRMenuDownLayoutPaddingSwitch'));
                disableBtn(document.getElementById('MRMenuPutSendingBarInPlayerSwitch'));
                moveTitleAndUpinfo();
            });
            document.getElementById('MRMenuFullscreenSlider').addEventListener('click', function () {
                if (GM_getValue('MRPlayerMode') == 2) return;
                GM_setValue('MRPlayerMode', 2);
                document.getElementById('MRMenuNormalCheckbox').checked = false;
                document.getElementById('MRMenuAutoWidescreenCheckbox').checked = false;
                fullscreen();
                document.getElementById('MRMenuNormalSwitch').style.pointerEvents = '';
                document.getElementById('MRMenuAutoWidescreenSwitch').style.pointerEvents = '';
                document.getElementById('MRMenuFullscreenSwitch').style.pointerEvents = 'none';
                enableBtn(document.getElementById('MRMenuMoveNavigationBarSwitch'));
                enableBtn(document.getElementById('MRMenuDownLayoutPaddingSwitch'));
                enableBtn(document.getElementById('MRMenuPutSendingBarInPlayerSwitch'));
                moveTitleAndUpinfo();
            });

            var simpleBindings = [
                ['MRMenuMoveNavigationBar', 'MRMenuMoveNavigationBar', moveNavigationBar],
                ['MRMenuHideFeedbackBtn', 'MRMenuHideFeedbackBtn', hideFeedbackBtn],
                ['MRMenuDownLayoutPadding', 'MRMenuDownLayoutPadding', downLayoutPadding],
                ['MRMenuDownLayoutSearchBarFull', 'MRMenuDownLayoutSearchBarFull', searchBarFull],
                ['MRMenuPutSendingBarInPlayer', 'MRMenuPutSendingBarInPlayer', putSendingBarInPlayer],
                ['MRMenuHideVideoInfo', 'MRMenuHideVideoInfo', hideVideoInfo],
                ['MRMenuDisplayEplist', 'MRMenuDisplayEplist', null],
                ['MRMenuDisplayTitle', 'MRMenuDisplayTitle', displayTitle],
                ['MRMenuHideFollowBtn', 'MRMenuHideFollowBtn', hideFollowBtn],
                ['MRMenuMoveTitleAndUpinfo', 'MRMenuMoveTitleAndUpinfo', moveTitleAndUpinfo],
                ['MRMenuBetterToolTip', 'MRMenuBetterToolTip', betterToolTip],
                ['MRMenuHideProgressArea', 'MRMenuHideProgressArea', hideProgressArea],
                ['MRMenuSmartNextPlay', 'MRMenuSmartNextPlay', null],
                ['MRMenuEscQuitViewImage', 'MRMenuEscQuitViewImage', null],
                ['MRMenuAlwaysOpenSubtitle', 'MRMenuAlwaysOpenSubtitle', alwaysOpenSubtitle]
            ];
            simpleBindings.forEach(function (b) {
                var slider = document.getElementById(b[1] + 'Slider');
                if (!slider) return;
                slider.addEventListener('click', function () {
                    var cur = GM_getValue(b[0]);
                    GM_setValue(b[0], cur == 1 ? 0 : 1);
                    if (b[2]) b[2]();
                });
            });

            document.getElementById('MRMenuTransparentSlider').addEventListener('click', function () {
                if (GM_getValue('MRMenuTransparent') == 1) GM_setValue('MRMenuTransparent', 0.7);
                else GM_setValue('MRMenuTransparent', 1);
                MRMenuElement.style.opacity = GM_getValue('MRMenuTransparent');
            });

            document.getElementById('MRMenuMoveWindowToTopSlider').addEventListener('click', function () {
                var cur = GM_getValue('MRMenuMoveWindowToTop');
                GM_setValue('MRMenuMoveWindowToTop', cur == 1 ? 0 : 1);
                if (cur == 0) moveWindowToTop();
            });
            ['MRMenuRemoveWidescreenBlack', 'MRMenuRemoveKeyword', 'MRMenuRemoveUselessComment', 'MRMenuMoreVideoSpeed', 'MRMenuWatchLaterReplaceURL', 'MRMenuFixPIPDelay'].forEach(function (k) {
                var map = {
                    MRMenuRemoveWidescreenBlack: removeWidescreenBlack, MRMenuRemoveKeyword: removeKeyword,
                    MRMenuRemoveUselessComment: removeUselessComment, MRMenuMoreVideoSpeed: moreVideoSpeed,
                    MRMenuWatchLaterReplaceURL: watchLaterReplaceURL, MRMenuFixPIPDelay: fixPIPDelay
                };
                var slider = document.getElementById(k + 'Slider');
                if (!slider) return;
                slider.addEventListener('click', function () {
                    var cur = GM_getValue(k);
                    GM_setValue(k, cur == 1 ? 0 : 1);
                    if (map[k]) map[k]();
                });
            });

            for (var i = 0; i < 11; i++) {
                (function (idx) {
                    var cb = document.getElementById('MRMenuHideNavigationBarTag' + idx + 'Checkbox');
                    if (!cb) return;
                    cb.addEventListener('click', function () {
                        var s = GM_getValue('MRMenuHideNavigationBarTag').split('');
                        while (s.length < 11) s.push('0');
                        s[idx] = s[idx] == '1' ? '0' : '1';
                        GM_setValue('MRMenuHideNavigationBarTag', s.join(''));
                        hideNavigationBarTag();
                    });
                })(i);
            }

            document.getElementById('MRMenuAlwaysDisableDnmaku0Checkbox').addEventListener('click', function () {
                var cur = GM_getValue('MRMenuAlwaysDisableDnmaku').split('');
                if (cur[0] == '0') {
                    cur[0] = '1';
                    enableBtn(document.getElementById('MRMenuAlwaysDisableDnmaku1Switch'));
                    enableBtn(document.getElementById('MRMenuAlwaysDisableDnmaku2Switch'));
                } else {
                    cur[0] = '0';
                    disableBtn(document.getElementById('MRMenuAlwaysDisableDnmaku1Switch'));
                    disableBtn(document.getElementById('MRMenuAlwaysDisableDnmaku2Switch'));
                }
                GM_setValue('MRMenuAlwaysDisableDnmaku', cur.join(''));
            });
            document.getElementById('MRMenuAlwaysDisableDnmaku1Checkbox').addEventListener('click', function () {
                var cur = GM_getValue('MRMenuAlwaysDisableDnmaku').split('');
                if (cur[1] == '0') {
                    cur[1] = '1'; cur[2] = '0';
                    document.getElementById('MRMenuAlwaysDisableDnmaku2Checkbox').checked = false;
                    document.getElementById('MRMenuAlwaysDisableDnmaku1Switch').style.pointerEvents = 'none';
                    document.getElementById('MRMenuAlwaysDisableDnmaku2Switch').style.pointerEvents = '';
                }
                GM_setValue('MRMenuAlwaysDisableDnmaku', cur.join(''));
                alwaysDisableDnmaku();
            });
            document.getElementById('MRMenuAlwaysDisableDnmaku2Checkbox').addEventListener('click', function () {
                var cur = GM_getValue('MRMenuAlwaysDisableDnmaku').split('');
                if (cur[2] == '0') {
                    cur[2] = '1'; cur[1] = '0';
                    document.getElementById('MRMenuAlwaysDisableDnmaku1Checkbox').checked = false;
                    document.getElementById('MRMenuAlwaysDisableDnmaku1Switch').style.pointerEvents = '';
                    document.getElementById('MRMenuAlwaysDisableDnmaku2Switch').style.pointerEvents = 'none';
                }
                GM_setValue('MRMenuAlwaysDisableDnmaku', cur.join(''));
                alwaysDisableDnmaku();
            });
        }

        function disableBtn(el) { if (!el) return; el.style.pointerEvents = 'none'; if (el.children[1]) el.children[1].setAttribute('mr_disable', 'true'); }
        function enableBtn(el) { if (!el) return; el.style.pointerEvents = ''; if (el.children[1]) el.children[1].setAttribute('mr_disable', ''); }
        function changeText(str, loc, newText) { var s = GM_getValue(str).split(''); s[loc] = newText; GM_setValue(str, s.join('')); }

        function autoWidescreen() {
            var isOn = GM_getValue('MRPlayerMode') == 1;
            if (webStatus == 0 || webStatus == 2) {
                autoWidescreenBtn = 'bpx-player-ctrl-wide';
                autoWidescreenisWidescreenClass = 'bpx-state-entered';
            } else if (webStatus == 1) {
                autoWidescreenBtn = 'squirtle-video-widescreen';
                autoWidescreenisWidescreenClass = 'active';
            } else return;

            (function check() {
                var btn = document.getElementsByClassName(autoWidescreenBtn)[0];
                if (btn) {
                    var active = btn.className.indexOf(autoWidescreenisWidescreenClass) !== -1 ||
                        btn.classList.contains('active') ||
                        btn.getAttribute('aria-pressed') === 'true';
                    if (isOn && !active) {
                        btn.click();
                        console.log('[' + notificationScriptName + '-' + notificationNotification + '] 自动宽屏模式 - 已开启');
                        if (GM_getValue('MRMenuMoveWindowToTop') == 1) moveWindowToTop();
                    } else if (!isOn && active) {
                        btn.click();
                        console.log('[' + notificationScriptName + '-' + notificationNotification + '] 自动宽屏模式 - 已关闭');
                        if (GM_getValue('MRMenuMoveWindowToTop') == 1) moveWindowToTop();
                    } else {
                        console.log('[' + notificationScriptName + '-' + notificationNotification + '] 自动宽屏模式 - 状态已符合预期');
                    }
                } else {
                    setTimeout(check, 200);
                }
            })();
        }

        function fullscreen() {
            if (GM_getValue('MRPlayerMode') == 2) {
                if (webStatus == 0) enterFullscreenVideo();
                else if (webStatus == 1) enterFullscreenMovie();
                else if (webStatus == 2) enterFullscreenList();
            } else {
                if (webStatus == 0) exitFullscreenVideo();
                if (webStatus == 1) exitFullscreenMovie();
                if (webStatus == 2) exitFullscreenList();
            }
        }

        function getVideoContainers() {
            return {
                left: document.querySelector('.left-container') || document.querySelector('[class*="video-left"]'),
                right: document.querySelector('.right-container') || document.querySelector('[class*="video-right"]')
            };
        }

        function enterFullscreenVideo() {
            (function check() {
                if (document.getElementsByClassName('bpx-player-ctrl-time-duration')[0] && loadReady) {
                    var player = document.getElementById('bilibili-player');
                    var playerWrap = document.getElementById('playerWrap');
                    if (!player || !playerWrap) return;
                    var navH = GM_getValue('MRMenuMoveNavigationBar') == 0 ? 'calc(100vh - 64px)' : '100vh';
                    player.style.cssText += 'width: 100% !important; height: ' + navH + ' !important;';
                    playerWrap.style.cssText += 'height: auto !important; z-index: 50 !important;';
                    var app = document.getElementById('app');
                    var vc = document.getElementsByClassName('video-container-v1')[0];
                    if (app && vc) app.insertBefore(playerWrap, vc);
                    var sending = document.getElementsByClassName('bpx-player-sending-area')[0];
                    if (sending) { playerWrap.appendChild(sending); sending.setAttribute('mr_always_display', 'true'); }
                    if (GM_getValue('MRMenuMoveWindowToTop') == 1) moveWindowToTop();
                    if (GM_getValue('MRMenuMoveNavigationBar') == 1) moveNavigationBar();
                    if (GM_getValue('MRMenuDownLayoutPadding') == 1) downLayoutPadding();
                    if (GM_getValue('MRMenuPutSendingBarInPlayer') == 1) putSendingBarInPlayer();
                    var wide = document.getElementsByClassName('bpx-player-ctrl-wide')[0];
                    var web = document.getElementsByClassName('bpx-player-ctrl-web')[0];
                    if (wide) wide.style.display = 'none';
                    if (web) web.style.display = 'none';
                    var info = document.getElementsByClassName('bpx-player-video-info')[0];
                    if (info) info.style.width = 'auto';
                    var lc = document.getElementsByClassName('left-container')[0];
                    if (lc) lc.style.cssText += 'z-index: unset !important; position: unset !important;';
                    console.log('[' + notificationScriptName + '-' + notificationNotification + '] 网页全屏模式 - 视频页已开启');
                } else {
                    setTimeout(check, 200);
                }
            })();
        }

        function exitFullscreenVideo() {
            (function check() {
                if (document.getElementsByClassName('bpx-player-sending-area')[0] && loadReady) {
                    var player = document.getElementById('bilibili-player');
                    var playerWrap = document.getElementById('playerWrap');
                    if (player) { player.style.width = ''; player.style.height = ''; }
                    if (playerWrap) { playerWrap.style.height = ''; playerWrap.style.zIndex = ''; }
                    var lc = document.getElementsByClassName('left-container')[0];
                    var arc = document.getElementById('arc_toolbar_report');
                    if (lc && playerWrap) {
                        lc.appendChild(playerWrap);
                        if (arc) lc.insertBefore(playerWrap, arc);
                    }
                    var primary = document.getElementsByClassName('bpx-player-primary-area')[0];
                    var sending = document.getElementsByClassName('bpx-player-sending-area')[0];
                    if (primary && sending) primary.appendChild(sending);
                    if (sending) sending.setAttribute('mr_always_display', '');
                    if (GM_getValue('MRMenuMoveNavigationBar') == 1) moveNavigationBar();
                    if (GM_getValue('MRMenuDownLayoutPadding') == 1) downLayoutPadding();
                    if (GM_getValue('MRMenuPutSendingBarInPlayer') == 1) putSendingBarInPlayer();
                    var wide = document.getElementsByClassName('bpx-player-ctrl-wide')[0];
                    var web = document.getElementsByClassName('bpx-player-ctrl-web')[0];
                    if (wide) wide.style.display = 'block';
                    if (web) web.style.display = 'block';
                    var info = document.getElementsByClassName('bpx-player-video-info')[0];
                    if (info) info.style.width = '';
                    console.log('[' + notificationScriptName + '-' + notificationNotification + '] 网页全屏模式 - 视频页已关闭');
                } else {
                    setTimeout(check, 200);
                }
            })();
        }

        function enterFullscreenMovie() {
            (function check() {
                var player = document.querySelector('[id*="bilibili-player"], [class*="bpx-player"]');
                if (!player || !loadReady) {
                    setTimeout(check, 200);
                    return;
                }

                var navH = GM_getValue('MRMenuMoveNavigationBar') == 0 ? 'calc(100vh - 64px)' : '100vh';
                player.style.cssText += 'width: 100% !important; height: ' + navH + ' !important;';

                var wrap = document.getElementById('bilibili-player-wrap');
                if (wrap) wrap.setAttribute('mr_fullscreen', 'true');

                var mc = document.querySelector('.main-container');
                var pl = document.querySelector('.plp-l');
                var pr = document.querySelector('.plp-r');
                if (mc) mc.setAttribute('mr_fullscreen', 'true');
                if (pl) pl.setAttribute('mr_fullscreen', 'true');
                if (pr) pr.setAttribute('mr_fullscreen', 'true');

                var next = document.getElementById('__next');
                if (next && document.body) {
                    document.body.insertBefore(player, next);
                }

                var sending = document.querySelector('.bpx-player-sending-area');
                if (sending) sending.setAttribute('mr_always_display', 'true');

                var sc = document.querySelector('.special-cover');
                if (sc) sc.style.display = 'none';

                if (GM_getValue('MRMenuMoveWindowToTop') == 1) moveWindowToTop();
                if (GM_getValue('MRMenuMoveNavigationBar') == 1) moveNavigationBar();
                if (GM_getValue('MRMenuDownLayoutPadding') == 1) downLayoutPadding();
                if (GM_getValue('MRMenuPutSendingBarInPlayer') == 1) putSendingBarInPlayer();

                var wide = document.querySelector('.bpx-player-ctrl-wide, .squirtle-wide-inactive');
                if (wide) wide.style.display = 'none';

                var info = document.querySelector('.bpx-player-video-info');
                if (info) info.setAttribute('mr_fullscreen', 'true');

                console.log('[' + notificationScriptName + '-' + notificationNotification + '] 网页全屏模式 - 番剧/影视已开启（通用容器）');
            })();
        }

        function exitFullscreenMovie() {
            (function check() {
                var player = document.querySelector('[id*="bilibili-player"], [class*="bpx-player"]');
                if (!player || !loadReady) {
                    setTimeout(check, 200);
                    return;
                }

                player.style.width = '';
                player.style.height = '';

                ['bilibili-player-wrap', 'main-container', 'plp-l', 'plp-r'].forEach(function (cls) {
                    var el = document.getElementById(cls) || document.querySelector('.' + cls);
                    if (el) el.setAttribute('mr_fullscreen', '');
                });

                var pl2 = document.querySelector('.plp-l');
                var pm = document.getElementById('player_module');
                var mw = document.querySelector('.media-wrapper');
                if (pl2 && pm && mw) pl2.insertBefore(pm, mw);

                var sending = document.querySelector('.bpx-player-sending-area');
                if (sending) sending.setAttribute('mr_always_display', '');

                var sc = document.querySelector('.special-cover');
                if (sc) sc.style.display = '';

                if (GM_getValue('MRMenuMoveNavigationBar') == 1) moveNavigationBar();
                if (GM_getValue('MRMenuDownLayoutPadding') == 1) downLayoutPadding();
                if (GM_getValue('MRMenuPutSendingBarInPlayer') == 1) putSendingBarInPlayer();

                var wide = document.querySelector('.bpx-player-ctrl-wide, .squirtle-wide-inactive');
                if (wide) wide.style.display = 'block';

                var info = document.querySelector('.bpx-player-video-info');
                if (info) info.setAttribute('mr_fullscreen', '');

                console.log('[' + notificationScriptName + '-' + notificationNotification + '] 网页全屏模式 - 番剧/影视已关闭（通用容器）');
            })();
        }

        function enterFullscreenList() {
            (function check() {
                if (document.getElementsByClassName('bpx-player-ctrl-time-duration')[0] && loadReady) {
                    var player = document.getElementById('bilibili-player');
                    var playerWrap = document.getElementById('playerWrap');
                    if (!player || !playerWrap) return;
                    var navH = GM_getValue('MRMenuMoveNavigationBar') == 0 ? 'calc(100vh - 64px)' : '100vh';
                    player.style.cssText += 'width: 100% !important; height: ' + navH + ' !important;';
                    playerWrap.style.cssText += 'height: auto !important; z-index: 50 !important;';
                    var app = document.getElementById('app');
                    var pc = document.getElementsByClassName('playlist-container')[0];
                    if (app && pc) app.insertBefore(playerWrap, pc);
                    var sending = document.getElementsByClassName('bpx-player-sending-area')[0];
                    if (sending) { playerWrap.appendChild(sending); sending.setAttribute('mr_always_display', 'true'); }
                    if (GM_getValue('MRMenuMoveWindowToTop') == 1) moveWindowToTop();
                    if (GM_getValue('MRMenuMoveNavigationBar') == 1) moveNavigationBar();
                    if (GM_getValue('MRMenuDownLayoutPadding') == 1) downLayoutPadding();
                    if (GM_getValue('MRMenuPutSendingBarInPlayer') == 1) putSendingBarInPlayer();
                    var wide = document.getElementsByClassName('bpx-player-ctrl-wide')[0];
                    var web = document.getElementsByClassName('bpx-player-ctrl-web')[0];
                    if (wide) wide.style.display = 'none';
                    if (web) web.style.display = 'none';
                    var info = document.getElementsByClassName('bpx-player-video-info')[0];
                    if (info) info.style.width = 'auto';
                    console.log('[' + notificationScriptName + '-' + notificationNotification + '] 网页全屏模式 - 列表已开启');
                } else {
                    setTimeout(check, 200);
                }
            })();
        }

        function exitFullscreenList() {
            (function check() {
                if (document.getElementsByClassName('bpx-player-sending-area')[0] && loadReady) {
                    var player = document.getElementById('bilibili-player');
                    var playerWrap = document.getElementById('playerWrap');
                    if (player) { player.style.width = ''; player.style.height = ''; }
                    if (playerWrap) { playerWrap.style.height = ''; playerWrap.style.zIndex = ''; }
                    var pl = document.getElementsByClassName('playlist-container--left')[0];
                    var tb = document.getElementById('playlistToolbar');
                    if (pl && playerWrap) { pl.appendChild(playerWrap); if (tb) pl.insertBefore(playerWrap, tb); }
                    var primary = document.getElementsByClassName('bpx-player-primary-area')[0];
                    var sending = document.getElementsByClassName('bpx-player-sending-area')[0];
                    if (primary && sending) primary.appendChild(sending);
                    if (sending) sending.setAttribute('mr_always_display', '');
                    if (GM_getValue('MRMenuMoveNavigationBar') == 1) moveNavigationBar();
                    if (GM_getValue('MRMenuDownLayoutPadding') == 1) downLayoutPadding();
                    if (GM_getValue('MRMenuPutSendingBarInPlayer') == 1) putSendingBarInPlayer();
                    var wide = document.getElementsByClassName('bpx-player-ctrl-wide')[0];
                    var web = document.getElementsByClassName('bpx-player-ctrl-web')[0];
                    if (wide) wide.style.display = 'block';
                    if (web) web.style.display = 'block';
                    var info = document.getElementsByClassName('bpx-player-video-info')[0];
                    if (info) info.style.width = '';
                    console.log('[' + notificationScriptName + '-' + notificationNotification + '] 网页全屏模式 - 列表已关闭');
                } else {
                    setTimeout(check, 200);
                }
            })();
        }

        function moveNavigationBar() {
            (function check() {
                var header = document.getElementById('biliMainHeader');
                var headerBar = document.getElementsByClassName('bili-header__bar')[0];
                if (header && headerBar && loadReady) {
                    if (GM_getValue('MRPlayerMode') != 2) {
                        headerBar.style.position = ''; headerBar.style.zIndex = '';
                    } else if (GM_getValue('MRMenuMoveNavigationBar') == 0) {
                        headerBar.style.position = ''; headerBar.style.zIndex = '';
                        var app = document.getElementById('app');
                        var pw = document.getElementById('playerWrap');
                        if (app && pw) app.insertBefore(header, pw);
                        var player = document.getElementById('bilibili-player');
                        if (player) player.style.height = 'calc(100vh - 64px) !important';
                    } else {
                        headerBar.style.cssText += 'position: relative !important; z-index: 10 !important;';
                        if (webStatus == 0) {
                            var app = document.getElementById('app');
                            var vc = document.getElementsByClassName('video-container-v1')[0];
                            if (app && vc) app.insertBefore(header, vc);
                        } else if (webStatus == 1) {
                            var nx = document.getElementById('__next');
                            if (nx) document.body.insertBefore(header, nx);
                        } else if (webStatus == 2) {
                            var app = document.getElementById('app');
                            var pc = document.getElementsByClassName('playlist-container')[0];
                            if (app && pc) app.insertBefore(header, pc);
                        }
                        var player = document.getElementById('bilibili-player');
                        if (player) player.style.height = '100vh !important';
                    }
                } else {
                    setTimeout(check, 200);
                }
            })();
        }

        function hideFeedbackBtn() {
            (function check() {
                var target = null, list = [];
                if (webStatus == 1) {
                    var plp = document.getElementsByClassName('plp-r')[0];
                    if (plp && plp.nextElementSibling && plp.nextElementSibling.children[0] && plp.nextElementSibling.children[0].children[0]) {
                        target = plp.nextElementSibling.children[0].children[0];
                    }
                } else if (webStatus == 4 || webStatus == 5) {
                    var cls = webStatus == 4 ? 'side-buttons' : 'palette-button-wrap';
                    var el = document.getElementsByClassName(cls)[0];
                    if (el) for (var i = 0; i < el.children.length; i++) if (i != el.children.length - 1) list.push(el.children[i]);
                }
                if (target || list.length) {
                    var on = GM_getValue('MRMenuHideFeedbackBtn') == 1;
                    if (target) target.style.display = on ? 'none' : 'block';
                    list.forEach(function (c) { c.style.display = on ? 'none' : 'block'; });
                } else {
                    setTimeout(check, 200);
                }
            })();
        }

        function downLayoutPadding() {
            (function check() {
                var on = GM_getValue('MRMenuDownLayoutPadding') == 1 && GM_getValue('MRPlayerMode') == 2;
                if (webStatus == 0) {
                    var lc = document.getElementsByClassName('left-container')[0];
                    var vc = document.getElementsByClassName('video-container-v1')[0];
                    if (lc && vc) {
                        vc.style.justifyContent = on ? 'space-between' : '';
                        vc.style.padding = on ? '0px 20px' : '';
                        lc.style.flexGrow = on ? '1' : '';
                    } else { setTimeout(check, 200); }
                } else if (webStatus == 1) {
                    var mc = document.getElementsByClassName('main-container')[0];
                    if (mc) {
                        if (on) {
                            mc.style.setProperty('width', '100%', 'important');
                            mc.style.setProperty('margin', '0 auto', 'important');
                            mc.style.setProperty('max-width', 'calc(100% - 20px)', 'important');
                        } else {
                            mc.style.removeProperty('width');
                            mc.style.removeProperty('margin');
                            mc.style.removeProperty('max-width');
                        }

                        var plc = document.getElementsByClassName('player-left-components')[0];
                        if (plc) {
                            plc.style.paddingRight = on ? '20px' : '';
                        }
                    } else {
                        setTimeout(check, 200);
                    }
                } else if (webStatus == 2) {
                    var pc = document.getElementsByClassName('playlist-container')[0];
                    var pcl = document.getElementsByClassName('playlist-container--left')[0];
                    if (pc && pcl) {
                        pc.style.justifyContent = on ? 'space-between' : '';
                        pc.style.padding = on ? '0px 20px' : '';
                        pcl.style.flexGrow = on ? '1' : '';
                    } else { setTimeout(check, 200); }
                }
            })();
        }

        function searchBarFull() {
            (function check() {
                var on = GM_getValue('MRMenuDownLayoutSearchBarFull') == 1;
                var el = document.getElementsByClassName('center-search__bar')[0] || document.getElementsByClassName('nav-search-box')[0];
                if (el) {
                    if (on) {
                        if (el.classList.contains('center-search__bar')) el.style.maxWidth = '100%';
                        else { el.style.width = '100%'; el.style.display = 'block'; var si = document.getElementsByClassName('search-icon')[0]; if (si) si.style.display = 'none'; }
                    } else {
                        el.style.maxWidth = ''; el.style.width = ''; el.style.display = '';
                        var si = document.getElementsByClassName('search-icon')[0]; if (si) si.style.display = '';
                    }
                } else { setTimeout(check, 200); }
            })();
        }

        function putSendingBarInPlayer() {
            (function check() {
                if (document.getElementsByClassName('bpx-player-dm-wrap')[0] && document.getElementsByClassName('bpx-player-dm-hint')[0]) {
                    var sending = document.getElementsByClassName('bpx-player-sending-area')[0];
                    if (!sending) return;
                    if (GM_getValue('MRPlayerMode') == 2 && GM_getValue('MRMenuPutSendingBarInPlayer') == 1) {
                        var bottom = document.getElementsByClassName('bpx-player-control-bottom-center')[0];
                        if (bottom) {
                            bottom.style.cssText += 'width: 50%; height: 34px; line-height: 34px;';
                            sending.setAttribute('mr_inside_player', 'true');
                            bottom.appendChild(sending);
                            var bar = document.getElementsByClassName('bpx-player-sending-bar')[0];
                            if (bar) bar.style.cssText += 'background: none; height: 34px; line-height: 34px; margin: -6px auto;';
                            var info = document.getElementsByClassName('bpx-player-video-info')[0];
                            if (info) info.style.color = 'hsla(0,0%,100%,.8)';
                            var inputbar = document.getElementsByClassName('bpx-player-video-inputbar')[0];
                            if (inputbar) inputbar.style.cssText += 'width: auto; background: hsla(0,0%,100%,0.6);';
                            var dmInput = document.getElementsByClassName('bpx-player-dm-input')[0];
                            if (dmInput) { dmInput.style.color = 'hsla(0,0%,100%,.6)'; dmInput.setAttribute('mr_inside_player', 'true'); }
                        }
                    } else {
                        var pw = document.getElementById('playerWrap');
                        if (pw && GM_getValue('MRPlayerMode') == 2) pw.appendChild(sending);
                        else {
                            var primary = document.getElementsByClassName('bpx-player-primary-area')[0];
                            if (primary) primary.appendChild(sending);
                        }
                        sending.setAttribute('mr_inside_player', '');
                        var bottom = document.getElementsByClassName('bpx-player-control-bottom-center')[0];
                        if (bottom) { bottom.style.width = ''; bottom.style.height = ''; bottom.style.lineHeight = ''; }
                        var bar = document.getElementsByClassName('bpx-player-sending-bar')[0];
                        if (bar) { bar.style.background = ''; bar.style.height = ''; bar.style.lineHeight = ''; bar.style.margin = ''; }
                        var info = document.getElementsByClassName('bpx-player-video-info')[0];
                        if (info) info.style.color = '';
                        var inputbar = document.getElementsByClassName('bpx-player-video-inputbar')[0];
                        if (inputbar) { inputbar.style.width = ''; inputbar.style.background = ''; }
                        var dmInput = document.getElementsByClassName('bpx-player-dm-input')[0];
                        if (dmInput) { dmInput.style.color = ''; dmInput.setAttribute('mr_inside_player', ''); }
                    }
                } else { setTimeout(check, 200); }
            })();
        }

        function hideVideoInfo() {
            (function check() {
                var el = document.getElementsByClassName('bpx-player-video-info')[0];
                if (el) el.style.display = GM_getValue('MRMenuHideVideoInfo') == 1 ? 'none' : '';
                else { setTimeout(check, 200); }
            })();
        }

        function displayEplist() {
            var btn = (webStatus == 1) ? 'squirtle-pagelist-wrap' : 'bpx-player-ctrl-eplist';
            setInterval(function () {
                var el = document.getElementsByClassName(btn)[0];
                if (!el) return;
                if (GM_getValue('MRMenuDisplayEplist') == 1) {
                    if (webStatus == 1) el.setAttribute('mr_always_display', 'true');
                    else el.setAttribute('mr_show_eplist', 'true');
                } else {
                    if (webStatus == 1) el.setAttribute('mr_always_display', '');
                    else el.setAttribute('mr_show_eplist', '');
                }
            }, 500);
        }

        function displayTitle() {
            setInterval(function () {
                if (!document.getElementsByClassName('bpx-player-top-left-title')[0] || !loadReady) return;
                var title = document.getElementsByClassName('bpx-player-top-left-title')[0];
                var mask = document.getElementsByClassName('bpx-player-top-mask')[0];
                if (GM_getValue('MRMenuDisplayTitle') == 1) {
                    if (window.getComputedStyle(title, null)['display'] != 'block') title.style.cssText += 'display: block !important;';
                    if (mask && window.getComputedStyle(mask, null)['display'] != 'block') mask.style.cssText += 'display: block !important;';
                } else {
                    if (window.getComputedStyle(title, null)['display'] != 'none') title.style.display = 'none';
                    if (mask && window.getComputedStyle(mask, null)['display'] != 'none') mask.style.display = 'none';
                }
            }, 500);
        }

        function hideFollowBtn() {
            (function check() {
                var el = document.getElementsByClassName('bpx-player-follow')[0];
                if (el) el.style.cssText += GM_getValue('MRMenuHideFollowBtn') == 1 ? 'display: none !important;' : '';
                else { setTimeout(check, 200); }
            })();
        }

        function moveTitleAndUpinfo() {
            (function check() {
                var viewbox = document.getElementById('viewbox_report');
                var arc = document.getElementById('arc_toolbar_report');
                var upPanel = document.querySelector('.up-panel-container');
                var leftContainer = document.querySelector('.left-container');
                var rightContainerInner = document.querySelector('.right-container-inner');
                var playerWrap = document.getElementById('playerWrap');

                var isUpPanelReady = false;
                if (upPanel) {
                    var avatarImg = upPanel.querySelector('.bili-avatar-img, img');
                    var followBtn = upPanel.querySelector('.follow-btn');
                    // 创作团队使用独立的成员卡片，没有单 UP 主的 .follow-btn。
                    var membersInfo = upPanel.querySelector('.members-info-container, .mmembers-info-container');
                    if (avatarImg && (followBtn || membersInfo)) isUpPanelReady = true;
                }

                if (!loadReady || !viewbox || !arc || !upPanel || !leftContainer || !rightContainerInner || !isUpPanelReady) {
                    setTimeout(check, 200);
                    return;
                }

                var on = GM_getValue('MRMenuMoveTitleAndUpinfo') == 1;

                if (on) {
                    if (viewbox.parentNode !== leftContainer || upPanel.parentNode !== leftContainer ||
                        viewbox.nextElementSibling !== upPanel || upPanel.nextElementSibling !== arc) {
                        if (arc && arc.parentNode === leftContainer) {
                            leftContainer.insertBefore(viewbox, arc);
                        } else {
                            leftContainer.appendChild(viewbox);
                        }
                        if (arc && arc.parentNode === leftContainer) {
                            leftContainer.insertBefore(upPanel, arc);
                        } else {
                            leftContainer.appendChild(upPanel);
                        }
                    }

                    viewbox.setAttribute('mr_layout', 'true');
                    upPanel.setAttribute('mr_layout', 'true');
                    if (playerWrap) playerWrap.setAttribute('mr_layout', 'true');

                    upPanel.style.setProperty('display', 'flex', 'important');
                    upPanel.style.setProperty('flex-direction', 'row', 'important');
                    upPanel.style.setProperty('align-items', 'center', 'important');
                    upPanel.style.setProperty('width', '100%', 'important');

                    var upInfoContainer = upPanel.querySelector('.up-info-container');
                    if (upInfoContainer) {
                        upInfoContainer.style.setProperty('display', 'flex', 'important');
                        upInfoContainer.style.setProperty('flex-direction', 'row', 'important');
                        upInfoContainer.style.setProperty('align-items', 'center', 'important');
                        upInfoContainer.style.setProperty('width', '100%', 'important');
                    }

                    var upInfoLeft = upPanel.querySelector('.up-info--left');
                    if (upInfoLeft) {
                        upInfoLeft.style.setProperty('flex-shrink', '0', 'important');
                        upInfoLeft.style.setProperty('margin-right', '16px', 'important');
                    }

                    var upInfoRight = upPanel.querySelector('.up-info--right');
                    if (upInfoRight) {
                        upInfoRight.style.setProperty('display', 'flex', 'important');
                        upInfoRight.style.setProperty('flex-direction', 'row', 'important');
                        upInfoRight.style.setProperty('justify-content', 'space-between', 'important');
                        upInfoRight.style.setProperty('align-items', 'center', 'important');
                        upInfoRight.style.setProperty('flex', '1', 'important');
                        upInfoRight.style.setProperty('width', '0', 'important');
                        upInfoRight.style.setProperty('padding-left', '0', 'important');
                        upInfoRight.style.setProperty('margin', '0', 'important');
                    }

                    var upInfoDetail = upPanel.querySelector('.up-info__detail');
                    if (upInfoDetail) {
                        upInfoDetail.style.setProperty('display', 'flex', 'important');
                        upInfoDetail.style.setProperty('flex-direction', 'column', 'important');
                        upInfoDetail.style.setProperty('justify-content', 'center', 'important');
                        upInfoDetail.style.setProperty('align-items', 'flex-start', 'important');
                        upInfoDetail.style.setProperty('width', 'calc(100% - 300px)', 'important');
                        upInfoDetail.style.setProperty('margin', '0', 'important');
                    }

                    var upDetail = upPanel.querySelector('.up-detail');
                    if (upDetail) {
                        upDetail.style.setProperty('width', '100%', 'important');
                        upDetail.style.setProperty('overflow', 'hidden', 'important');
                    }

                    var upInfoBtnPanel = upPanel.querySelector('.up-info__btn-panel');
                    if (upInfoBtnPanel) {
                        upInfoBtnPanel.style.setProperty('display', 'flex', 'important');
                        upInfoBtnPanel.style.setProperty('flex-direction', 'row', 'important');
                        upInfoBtnPanel.style.setProperty('align-items', 'center', 'important');
                        upInfoBtnPanel.style.setProperty('flex-shrink', '0', 'important');
                        upInfoBtnPanel.style.setProperty('margin-left', '20px', 'important');
                    }

                    var upinfoBtnInner = upPanel.querySelector('.upinfo-btn-panel');
                    if (upinfoBtnInner) {
                        upinfoBtnInner.style.setProperty('margin-top', '0', 'important');
                        upinfoBtnInner.style.setProperty('margin', '0 0 0 20px', 'important');
                    }

                } else {
                    if (viewbox.parentNode === leftContainer) {
                        viewbox.removeAttribute('mr_layout');
                        if (playerWrap && playerWrap.parentNode === leftContainer) {
                            leftContainer.insertBefore(viewbox, playerWrap);
                        } else {
                            leftContainer.appendChild(viewbox);
                        }
                    }

                    if (upPanel.parentNode === leftContainer) {
                        upPanel.removeAttribute('mr_layout');
                        if (playerWrap) playerWrap.removeAttribute('mr_layout');

                        var danmukuBox = document.getElementById('danmukuBox');
                        if (danmukuBox && danmukuBox.parentNode === rightContainerInner) {
                            rightContainerInner.insertBefore(upPanel, danmukuBox);
                        } else {
                            if (rightContainerInner.firstChild) {
                                rightContainerInner.insertBefore(upPanel, rightContainerInner.firstChild);
                            } else {
                                rightContainerInner.appendChild(upPanel);
                            }
                        }

                        upPanel.style.removeProperty('display');
                        upPanel.style.removeProperty('flex-direction');
                        upPanel.style.removeProperty('align-items');
                        upPanel.style.removeProperty('width');

                        var resetUpInfoContainer = upPanel.querySelector('.up-info-container');
                        if (resetUpInfoContainer) {
                            resetUpInfoContainer.style.removeProperty('display');
                            resetUpInfoContainer.style.removeProperty('flex-direction');
                            resetUpInfoContainer.style.removeProperty('align-items');
                            resetUpInfoContainer.style.removeProperty('width');
                        }

                        var resetUpInfoLeft = upPanel.querySelector('.up-info--left');
                        if (resetUpInfoLeft) {
                            resetUpInfoLeft.style.removeProperty('flex-shrink');
                            resetUpInfoLeft.style.removeProperty('margin-right');
                        }

                        var resetUpInfoRight = upPanel.querySelector('.up-info--right');
                        if (resetUpInfoRight) {
                            resetUpInfoRight.style.removeProperty('display');
                            resetUpInfoRight.style.removeProperty('flex-direction');
                            resetUpInfoRight.style.removeProperty('justify-content');
                            resetUpInfoRight.style.removeProperty('align-items');
                            resetUpInfoRight.style.removeProperty('flex');
                            resetUpInfoRight.style.removeProperty('width');
                            resetUpInfoRight.style.removeProperty('padding-left');
                            resetUpInfoRight.style.removeProperty('margin');
                        }

                        var resetUpInfoDetail = upPanel.querySelector('.up-info__detail');
                        if (resetUpInfoDetail) {
                            resetUpInfoDetail.style.removeProperty('display');
                            resetUpInfoDetail.style.removeProperty('flex-direction');
                            resetUpInfoDetail.style.removeProperty('justify-content');
                            resetUpInfoDetail.style.removeProperty('align-items');
                            resetUpInfoDetail.style.removeProperty('width');
                            resetUpInfoDetail.style.removeProperty('margin');
                        }

                        var resetUpDetail = upPanel.querySelector('.up-detail');
                        if (resetUpDetail) {
                            resetUpDetail.style.removeProperty('width');
                            resetUpDetail.style.removeProperty('overflow');
                        }

                        var resetUpInfoBtnPanel = upPanel.querySelector('.up-info__btn-panel');
                        if (resetUpInfoBtnPanel) {
                            resetUpInfoBtnPanel.style.removeProperty('display');
                            resetUpInfoBtnPanel.style.removeProperty('flex-direction');
                            resetUpInfoBtnPanel.style.removeProperty('align-items');
                            resetUpInfoBtnPanel.style.removeProperty('flex-shrink');
                            resetUpInfoBtnPanel.style.removeProperty('margin-left');
                        }

                        var resetUpinfoBtnInner = upPanel.querySelector('.upinfo-btn-panel');
                        if (resetUpinfoBtnInner) {
                            resetUpinfoBtnInner.style.removeProperty('margin-top');
                            resetUpinfoBtnInner.style.removeProperty('margin');
                        }
                    }
                }
            })();
        }

        var betterToolTipStyle;
        function betterToolTip() {
            if (!betterToolTipStyle) { betterToolTipStyle = document.createElement('style'); MRMenuElement.appendChild(betterToolTipStyle); }
            (function check() {
                var el = document.getElementsByClassName('bpx-player-tooltip-area')[0];
                if (el) {
                    if (GM_getValue('MRMenuBetterToolTip') == 1) {
                        el.style.cssText += 'display: none !important;';
                        betterToolTipStyle.innerHTML = '.bpx-player-volume-hint{top:unset!important;bottom:8%!important;border-radius:10px;!important;}';
                    } else {
                        el.style.display = '';
                        betterToolTipStyle.innerHTML = '';
                    }
                } else { setTimeout(check, 200); }
            })();
        }

        var hideProgressAreaObserver = null;
        function hideProgressArea() {
            var lastState = null;
            var warnCount = 0;

            function applyAttribute() {
                var el = document.querySelector('.bpx-player-shadow-progress-area');

                if (el) {
                    warnCount = 0;
                    var isHide = GM_getValue('MRMenuHideProgressArea') == 1;
                    var targetVal = isHide ? 'true' : 'false';

                    if (el.getAttribute('mr_hide_progress_area') !== targetVal) {
                        el.setAttribute('mr_hide_progress_area', targetVal);

                        if (lastState !== targetVal) {
                            console.log('[' + notificationScriptName + '-' + notificationNotification + '] ' + '隐藏视频底部蓝条 - 已成功设置 .bpx-player-shadow-progress-area 的 mr_hide_progress_area="' + targetVal + '"');
                            lastState = targetVal;
                        }
                    }
                } else {
                    if (warnCount === 0) {
                        console.log('[' + notificationScriptName + '-' + notificationCheck + '] ' + '隐藏视频底部蓝条 - 正在等待 .bpx-player-shadow-progress-area 容器加载...');
                    }
                    warnCount++;
                }
            }

            applyAttribute();

            if (hideProgressAreaObserver) {
                hideProgressAreaObserver.disconnect();
                hideProgressAreaObserver = null;
            }

            if (document.body) {
                hideProgressAreaObserver = new MutationObserver(function () {
                    applyAttribute();
                });
                hideProgressAreaObserver.observe(document.body, { childList: true, subtree: true });
            }

            setInterval(applyAttribute, 200);
        }

        function hideNavigationBarTag() {
            (function check() {
                var leftEntry = document.querySelector('.left-entry');
                if (!leftEntry) {
                    setTimeout(check, 200);
                    return;
                }

                var conf = GM_getValue('MRMenuHideNavigationBarTag').split('');
                while (conf.length < 11) conf.push('0');

                function toggleHide(el, hide) {
                    if (!el) return;
                    if (hide) {
                        el.style.setProperty('display', 'none', 'important');
                        el.style.setProperty('margin', '0', 'important');
                        el.style.setProperty('padding', '0', 'important');
                        el.style.setProperty('width', '0', 'important');
                    } else {
                        el.style.removeProperty('display');
                        el.style.removeProperty('margin');
                        el.style.removeProperty('padding');
                        el.style.removeProperty('width');
                    }
                }

                var logoEl = leftEntry.querySelector('.big-logo, .trigger-icon');
                if (logoEl) {
                    toggleHide(logoEl, conf[0] == '1');
                }

                var walker = document.createTreeWalker(leftEntry, NodeFilter.SHOW_TEXT, null, false);
                var node;
                while (node = walker.nextNode()) {
                    if (node.nodeValue.trim() === '首页') {
                        var textEl = node.parentElement;

                        toggleHide(textEl, conf[1] == '1');

                        var arrow = textEl.nextElementSibling;
                        if (arrow && arrow.tagName.toLowerCase() === 'svg') {
                            toggleHide(arrow, conf[1] == '1');
                        } else {
                            var parentA = textEl.closest('a');
                            if (parentA && parentA.nextElementSibling && parentA.nextElementSibling.tagName.toLowerCase() === 'svg') {
                                toggleHide(parentA.nextElementSibling, conf[1] == '1');
                            }
                        }

                        var innerArrow = textEl.querySelector('svg');
                        if (innerArrow) {
                            toggleHide(innerArrow, conf[1] == '1');
                        }

                        break;
                    }
                }

                var navMap = [
                    { text: '番剧', idx: 2 },
                    { text: '直播', idx: 3 },
                    { text: '游戏', idx: 4 },
                    { text: '会员购', idx: 5 },
                    { text: '漫画', idx: 6 },
                    { text: '赛事', idx: 7 },
                    { text: '下载客户端', idx: 9 }
                ];

                leftEntry.querySelectorAll('a').forEach(function (a) {
                    if (a.querySelector('a')) return;
                    var txt = a.textContent.replace(/\s/g, '');
                    if (!txt || txt.includes('首页')) return;

                    navMap.forEach(function (item) {
                        if (txt.includes(item.text)) {
                            var wrap = a.closest('.v-popover-wrap.left-entry__item');

                            if (wrap && wrap !== leftEntry && !wrap.querySelector('.big-logo') && !wrap.textContent.includes('首页')) {
                                toggleHide(wrap, conf[item.idx] == '1');
                            } else {
                                toggleHide(a, conf[item.idx] == '1');
                            }
                        }
                    });
                });

                leftEntry.querySelectorAll('.left-loc-entry').forEach(function (ad) {
                    if (ad !== leftEntry) toggleHide(ad, conf[8] == '1');
                });

                if (conf[10] == '1') {
                    leftEntry.style.setProperty('margin-right', '0px', 'important');
                    if (leftEntry.parentElement) leftEntry.parentElement.style.setProperty('gap', '0px', 'important');
                } else {
                    leftEntry.style.removeProperty('margin-right');
                    if (leftEntry.parentElement) leftEntry.parentElement.style.removeProperty('gap');
                }

                setTimeout(check, 1000);
            })();
        }

        var smartNextPlayState;

        function smartNextPlayCleanup() {
            if (!smartNextPlayState) return;
            if (smartNextPlayState.observer) {
                smartNextPlayState.observer.disconnect();
                smartNextPlayState.observer = null;
            }
            if (smartNextPlayState.routeIntervalId != null) {
                clearInterval(smartNextPlayState.routeIntervalId);
                smartNextPlayState.routeIntervalId = null;
            }
            if (smartNextPlayState.pollIntervalId != null) {
                clearInterval(smartNextPlayState.pollIntervalId);
                smartNextPlayState.pollIntervalId = null;
            }
            if (smartNextPlayState.observerTimeoutId != null) {
                clearTimeout(smartNextPlayState.observerTimeoutId);
                smartNextPlayState.observerTimeoutId = null;
            }
        }

        function smartNextPlay() {
            if (!smartNextPlayState) {
                smartNextPlayState = {
                    observer: null,
                    routeIntervalId: null,
                    pollIntervalId: null,
                    observerTimeoutId: null
                };
            }

            smartNextPlayCleanup();

            if (GM_getValue('MRMenuSmartNextPlay') != 1) return;

            var isAdjusting = false;
            var lastUrl = location.href;

            function shouldEnableHandoff() {
                var currentUrl = location.href;

                if (webStatus == 1) {
                    var epMatch = currentUrl.match(/\/(ep\d+)/);
                    var currentEp = epMatch ? epMatch[1] : '';

                    var mainSection = null;
                    var allSections = document.querySelectorAll('[class*="SectionPanel_panel"]');
                    for (var s = 0; s < allSections.length; s++) {
                        var h3 = allSections[s].querySelector('h3');
                        if (h3 && h3.textContent.trim() === '正片') { mainSection = allSections[s]; break; }
                    }
                    if (!mainSection && allSections.length > 0) mainSection = allSections[0];
                    if (!mainSection) return false;

                    var titleWrap = mainSection.querySelector('[class*="SectionHeader_titleWrap"]');
                    if (titleWrap) {
                        var spans = titleWrap.querySelectorAll('span');
                        for (var si = 0; si < spans.length; si++) {
                            var m = (spans[si].textContent || '').match(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)/);
                            if (m) {
                                var cur = parseInt(m[1], 10);
                                var total = parseInt(m[2], 10);
                                if (total > 0) return cur < total;
                            }
                        }
                    }

                    var listRoot = mainSection.querySelector('[class*="EpisodeVirtualList"]') || mainSection;
                    var episodes = listRoot.querySelectorAll('a[href*="/bangumi/play/ep"]');
                    if (episodes.length === 0) return false;

                    var lastEpHref = episodes[episodes.length - 1].getAttribute('href') || '';
                    if (currentEp && lastEpHref.includes(currentEp)) return false;

                    var activeEl = listRoot.querySelector('[class*="activeNumber"]');
                    if (activeEl) {
                        var activeA = activeEl.closest('a') || activeEl;
                        var href = activeA.getAttribute('href') || '';
                        if (href && (href === lastEpHref || lastEpHref.includes(href))) return false;
                    }
                    return true;
                }

                if (webStatus == 2 || webStatus == 8) {
                    var bvidMatch = currentUrl.match(/(BV[a-zA-Z0-9]+)/i);
                    var bvid = bvidMatch ? bvidMatch[1].toUpperCase() : '';
                    var currentWrap = bvid ? document.querySelector('.action-list-item-wrap[data-key="' + bvid + '"]') : null;

                    if (!currentWrap) {
                        var allWraps = document.querySelectorAll('.action-list-item-wrap');
                        for (var i = 0; i < allWraps.length; i++) {
                            if (allWraps[i].querySelector('.playing-gif[style*="display: block"]') || allWraps[i].querySelector('.multip-list-item-active')) {
                                currentWrap = allWraps[i];
                                break;
                            }
                        }
                    }
                    if (!currentWrap) return false;

                    var multipList = currentWrap.querySelector('.multip-list');
                    if (!multipList || multipList.style.display === 'none') return false;

                    var pItems = multipList.querySelectorAll('.multip-list-item');
                    if (pItems.length === 0) return false;

                    var activeItem = multipList.querySelector('.multip-list-item-active');
                    if (activeItem) {
                        var lastItem = pItems[pItems.length - 1];
                        if (activeItem === lastItem || lastItem.contains(activeItem)) return false;
                    }
                    return true;
                }

                if (webStatus == 0) {
                    var pMatch = currentUrl.match(/[?&]p=(\d+)/);
                    var currentP = pMatch ? parseInt(pMatch[1], 10) : 1;

                    var podList = document.querySelector('.video-pod__list');
                    if (!podList) return false;

                    var allPodItems = [];
                    for (var ci = 0; ci < podList.children.length; ci++) {
                        if (podList.children[ci].hasAttribute('data-key')) {
                            allPodItems.push(podList.children[ci]);
                        }
                    }
                    if (allPodItems.length === 0) return false;

                    var bvidMatch2 = currentUrl.match(/(BV[a-zA-Z0-9]+)/i);
                    var bvid2 = bvidMatch2 ? bvidMatch2[1].toUpperCase() : '';
                    var currentPodItem = null;
                    if (bvid2) {
                        for (var pi = 0; pi < allPodItems.length; pi++) {
                            var key = allPodItems[pi].getAttribute('data-key') || '';
                            if (key && key.toUpperCase() === bvid2) { currentPodItem = allPodItems[pi]; break; }
                        }
                    }

                    if (!currentPodItem) {
                        for (var pi2 = 0; pi2 < allPodItems.length; pi2++) {
                            if (allPodItems[pi2].classList.contains('active')) { currentPodItem = allPodItems[pi2]; break; }
                        }
                    }

                    if (!currentPodItem) {
                        var ap = podList.querySelector('.page-item.active');
                        if (ap) currentPodItem = ap.closest('.pod-item, .video-pod__item');
                    }

                    if (!currentPodItem) {
                        var ah = podList.querySelector('.simple-base-item.head.active, .simple-base-item.active.head');
                        if (ah) currentPodItem = ah.closest('.pod-item, .video-pod__item');
                    }

                    if (!currentPodItem) return false;

                    var lastPodItem = allPodItems[allPodItems.length - 1];
                    var isLastPodItem = (currentPodItem === lastPodItem);

                    var currentPageItems = currentPodItem.querySelectorAll('.page-item');
                    var hasMultiplePages = currentPageItems.length > 1;

                    if (!isLastPodItem) {
                        return true;
                    }

                    if (hasMultiplePages) {
                        var activePageItem = currentPodItem.querySelector('.page-item.active');
                        if (activePageItem) {
                            var lastPageItem = currentPageItems[currentPageItems.length - 1];
                            if (activePageItem === lastPageItem) return false;
                            return true;
                        }
                        if (currentP >= currentPageItems.length) return false;
                        return true;
                    }

                    return false;
                }

                return false;
            }

            function simulateClick(el) {
                if (!el) return;
                ['mousedown', 'mouseup', 'click'].forEach(function (type) {
                    var evt = new MouseEvent(type, { bubbles: true, cancelable: true });
                    el.dispatchEvent(evt);
                });
            }

            function applyHandoff() {
                if (isAdjusting) return;

                var targetState = shouldEnableHandoff();
                var targetVal = targetState ? "0" : "2";

                var switchBtn = document.querySelector('.continuous-btn .switch-btn') ||
                    document.querySelector('.recommend-list-v1 .switch-btn') ||
                    document.querySelector('.squirtle-switch');
                if (switchBtn) {
                    var isCurrentlyOn = switchBtn.classList.contains('on') ||
                        switchBtn.classList.contains('squirtle-switch-on') ||
                        switchBtn.classList.contains('active');
                    if (isCurrentlyOn !== targetState) {
                        isAdjusting = true;
                        simulateClick(switchBtn.closest('.continuous-btn') || switchBtn);
                        console.log('[' + notificationScriptName + '-' + notificationNotification + '] 智能连播 - 已点击外部按钮设置为: ' + (targetState ? '自动切集' : '播完暂停'));
                        setTimeout(function () { isAdjusting = false; }, 1000);
                    }
                    return;
                }

                var targetRadio = document.querySelector(`input[type="radio"][name="bui-radio1"][value="${targetVal}"]`);
                if (targetRadio) {
                    if (!targetRadio.checked) {
                        isAdjusting = true;
                        targetRadio.checked = true;
                        ['click', 'input', 'change'].forEach(function (eventType) {
                            var evt = eventType === 'click'
                                ? new MouseEvent(eventType, { bubbles: true, cancelable: true })
                                : new Event(eventType, { bubbles: true });
                            targetRadio.dispatchEvent(evt);
                        });
                        var label = targetRadio.closest('label');
                        if (label) simulateClick(label);

                        console.log('[' + notificationScriptName + '-' + notificationNotification + '] 智能连播 - 已强行修改 Radio 状态为: ' + (targetState ? '自动切集' : '播完暂停'));
                        setTimeout(function () { isAdjusting = false; }, 1000);
                    }
                    return;
                }
            }

            if (!document.body) {
                setTimeout(smartNextPlay, 100);
                return;
            }

            applyHandoff();

            var observer = new MutationObserver(function () {
                if (smartNextPlayState.observerTimeoutId) return;
                smartNextPlayState.observerTimeoutId = setTimeout(function () {
                    smartNextPlayState.observerTimeoutId = null;
                    applyHandoff();
                }, 300);
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
            smartNextPlayState.observer = observer;

            smartNextPlayState.routeIntervalId = setInterval(function () {
                if (location.href !== lastUrl) {
                    lastUrl = location.href;
                    isAdjusting = false;
                    setTimeout(applyHandoff, 500);
                }
            }, 1000);

            smartNextPlayState.pollIntervalId = setInterval(applyHandoff, 1000);
        }

        function moveWindowToTop() {
            setTimeout(function () { window.scrollTo(0, 0); }, 200);
        }

        function removeWidescreenBlack() {
            var perch = document.getElementsByClassName('bpx-player-video-perch')[0];
            var primary = document.getElementsByClassName('bpx-player-primary-area')[0];
            if (!perch || !primary || !loadReady) { setTimeout(removeWidescreenBlack, 500); return; }
            var video = primary.querySelector('video, bwp-video');
            // 使用视频原始尺寸；元数据尚未加载时保留高度限制，避免竖屏被撑大。
            var isLandscape = video && video.videoWidth > 0 && video.videoHeight > 0 &&
                video.videoWidth >= video.videoHeight;
            var shouldRemove = GM_getValue('MRPlayerMode') != 2 &&
                GM_getValue('MRMenuRemoveWidescreenBlack') == 1 && isLandscape &&
                primary.parentElement.getAttribute('data-screen') == 'wide';
            if (shouldRemove) {
                perch.style.setProperty('height', 'auto', 'important');
                primary.style.setProperty('height', 'auto', 'important');
            } else {
                // 切换到竖屏、全屏或关闭选项时，分别清除本功能写入的高度。
                if (perch.style.height == 'auto') perch.style.removeProperty('height');
                if (primary.style.height == 'auto') primary.style.removeProperty('height');
            }
            setTimeout(removeWidescreenBlack, 500);
        }

        var removeKeywordStarted = false;
        function removeKeyword() {
            removeKeywordStarted = true;

            (function loop() {
                var host = document.getElementsByTagName('bili-comments')[0];
                if (!host || !host.shadowRoot) {
                    setTimeout(loop, 500);
                    return;
                }

                var on = GM_getValue('MRMenuRemoveKeyword') == 1;
                var htmlEl = document.getElementsByTagName('html')[0];
                var isDark = htmlEl && htmlEl.getAttribute('data-darkreader-scheme') === 'dark';
                var normalColor = isDark ? 'var(--darkreader-text--text1)' : 'var(--text1)';
                var targetState = on ? '1' : '0';

                function processShadow(root) {
                    if (!root) return;
                    try {
                        var links = root.querySelectorAll('a[href*="search.bilibili.com"]');
                        for (var i = 0; i < links.length; i++) {
                            var a = links[i];
                            var text = a.textContent || '';

                            if (text.indexOf('@') !== -1) continue;
                            if (text.indexOf('http') !== -1) continue;
                            if (a.getAttribute('data-type') === 'seek') continue;

                            if (a.getAttribute('data-mr-kw-state') === targetState) continue;
                            a.setAttribute('data-mr-kw-state', targetState);

                            if (on) {
                                a.style.pointerEvents = 'none';
                                a.style.cursor = 'text';
                                a.style.color = normalColor;
                                for (var k = 0; k < a.children.length; k++) {
                                    a.children[k].style.display = 'none';
                                }
                            } else {
                                a.style.pointerEvents = '';
                                a.style.cursor = '';
                                a.style.color = '';
                                for (var k2 = 0; k2 < a.children.length; k2++) {
                                    a.children[k2].style.display = '';
                                }
                            }
                        }

                        var all = root.querySelectorAll('*');
                        for (var j = 0; j < all.length; j++) {
                            if (all[j].shadowRoot) processShadow(all[j].shadowRoot);
                        }
                    } catch (e) { }
                }

                processShadow(host.shadowRoot);

                setTimeout(loop, 500);
            })();
        }

        var removeUselessCommentStarted = false;
        function removeUselessComment() {
            removeUselessCommentStarted = true;

            (function loop() {
                var host = document.getElementsByTagName('bili-comments')[0];
                if (!host || !host.shadowRoot || !host.shadowRoot.getElementById('feed') || !host.shadowRoot.getElementById('feed').children[0]) {
                    setTimeout(loop, 500);
                    return;
                }

                var on = GM_getValue('MRMenuRemoveUselessComment') == 1;
                var feed = host.shadowRoot.getElementById('feed');
                for (var i = 0; i < feed.children.length; i++) {
                    var c = feed.children[i];
                    if (!c.shadowRoot) continue;
                    var cmt = c.shadowRoot.getElementById('comment');
                    if (!cmt || !cmt.shadowRoot) continue;
                    var rich = cmt.shadowRoot.querySelector('bili-rich-text');
                    if (!rich || !rich.shadowRoot) continue;
                    var contents = rich.shadowRoot.getElementById('contents');
                    if (!contents) continue;
                    var useless = contents.children.length > 0;
                    for (var j = 0; j < contents.children.length; j++) {
                        var a = contents.children[j];
                        if (a.tagName != 'A') { useless = false; break; }
                        if (!a.textContent.match('@')) { useless = false; break; }
                    }
                    if (useless && on) c.style.display = 'none';
                    else if (useless && !on) c.style.display = '';
                }

                setTimeout(loop, 500);
            })();
        }

        function moreVideoSpeed() {
            (function check() {
                if (webStatus == 1) {
                    var list = document.getElementsByClassName('squirtle-speed-select-list')[0];
                    if (!list) { setTimeout(check, 500); return; }
                    var exists = false;
                    for (var i = 0; i < document.getElementsByClassName('squirtle-select-item').length; i++) {
                        if (document.getElementsByClassName('squirtle-select-item')[i].textContent == '5.0x') exists = true;
                    }
                    if (GM_getValue('MRMenuMoreVideoSpeed') == 1 && !exists) {
                        [3, 4, 5].forEach(function (r) {
                            var li = document.createElement('li');
                            li.setAttribute('class', 'squirtle-select-item');
                            li.textContent = r + '.0x';
                            li.addEventListener('click', function () {
                                for (var k = 0; k < document.getElementsByClassName('squirtle-select-item').length; k++) document.getElementsByClassName('squirtle-select-item')[k].setAttribute('class', 'squirtle-select-item');
                                this.setAttribute('class', 'squirtle-select-item active');
                                setTimeout(function () { document.getElementsByClassName('squirtle-speed-select-result')[0].textContent = r + '.0x'; }, 20);
                                document.getElementsByClassName('bpx-player-video-wrap')[0].children[0].playbackRate = r;
                            });
                            list.insertBefore(li, list.children[0]);
                        });
                    }
                } else {
                    var menu = document.getElementsByClassName('bpx-player-ctrl-playbackrate-menu')[0];
                    if (!menu) { setTimeout(check, 500); return; }
                    var exists = false;
                    for (var i = 0; i < document.getElementsByClassName('bpx-player-ctrl-playbackrate-menu-item').length; i++) {
                        if (document.getElementsByClassName('bpx-player-ctrl-playbackrate-menu-item')[i].textContent == '5.0x') exists = true;
                    }
                    if (GM_getValue('MRMenuMoreVideoSpeed') == 1 && !exists) {
                        [3, 4, 5].forEach(function (r) {
                            var li = document.createElement('li');
                            li.setAttribute('class', 'bpx-player-ctrl-playbackrate-menu-item');
                            li.setAttribute('data-value', r);
                            li.textContent = r + '.0x';
                            li.addEventListener('click', function () {
                                for (var k = 0; k < document.getElementsByClassName('bpx-player-ctrl-playbackrate-menu-item').length; k++) document.getElementsByClassName('bpx-player-ctrl-playbackrate-menu-item')[k].setAttribute('class', 'bpx-player-ctrl-playbackrate-menu-item');
                                this.setAttribute('class', 'bpx-player-ctrl-playbackrate-menu-item bpx-state-active');
                                setTimeout(function () { document.getElementsByClassName('bpx-player-ctrl-playbackrate-result')[0].textContent = r + '.0x'; }, 20);
                                document.getElementsByClassName('bpx-player-video-wrap')[0].children[0].playbackRate = r;
                            });
                            menu.insertBefore(li, menu.children[0]);
                        });
                    } else if (GM_getValue('MRMenuMoreVideoSpeed') != 1) {
                        var items = document.getElementsByClassName('bpx-player-ctrl-playbackrate-menu-item');
                        for (var i = items.length - 1; i >= 0; i--) {
                            if (items[i].textContent == '3.0x' || items[i].textContent == '4.0x' || items[i].textContent == '5.0x') items[i].remove();
                        }
                    }
                }
            })();
        }

        function watchLaterReplaceURL() {
            (function check() {
                if (webStatus != 8) return;
                if (!loadReady) { setTimeout(check, 500); return; }
                var box = document.getElementsByClassName('list-box')[0];
                if (!box || !box.children[0]) { setTimeout(check, 500); return; }
                var on = GM_getValue('MRMenuWatchLaterReplaceURL') == 1;
                for (var i = 0; i < box.children[0].children.length; i++) {
                    var item = box.children[0].children[i];
                    if (!item.children[1] || !item.children[2]) continue;
                    if (on) {
                        item.children[1].href = item.children[1].href.replace('medialist/play/watchlater', 'video');
                        item.children[2].children[0].href = item.children[2].children[0].href.replace('medialist/play/watchlater', 'video');
                    } else {
                        item.children[1].href = item.children[1].href.replace(/\/video/, 'medialist/play/watchlater');
                    }
                }
            })();
        }

        (function escQuitViewImage() {
            if (document.body) {
                document.body.addEventListener('keydown', function (e) {
                    if (e.key == 'Escape' && GM_getValue('MRMenuEscQuitViewImage') == 1) {
                        var img = document.getElementsByClassName('reply-view-image')[0];
                        var close = document.getElementsByClassName('operation-btn-icon close-container')[0];
                        if (img && close) close.click();
                    }
                });
            } else setTimeout(escQuitViewImage, 20);
        })();

        function togglePIP() {
            var v = document.getElementsByTagName('video')[0] || document.getElementsByTagName('bwp-video')[0];
            if (!v) return;
            if (document.pictureInPictureElement == null) v.requestPictureInPicture();
            else document.exitPictureInPicture();
        }
        function fixPIPDelay() {
            (function check() {
                var btn = document.getElementsByClassName('bpx-player-ctrl-pip')[0];
                if (btn && btn.children[0] && btn.children[1]) {
                    if (GM_getValue('MRMenuFixPIPDelay') == 1) {
                        btn.children[0].addEventListener('click', togglePIP);
                        btn.children[1].addEventListener('click', togglePIP);
                    }
                } else setTimeout(check, 200);
            })();
        }

        function alwaysOpenSubtitle() {
            if (GM_getValue('MRMenuAlwaysOpenSubtitle') != 1) return;
            (function check() {
                var el = document.getElementsByClassName('bpx-player-ctrl-subtitle')[0];
                if (el && el.children[0] && el.children[0].children[0]) el.children[0].children[0].click();
                else { setTimeout(check, 200); }
            })();
        }

        function alwaysDisableDnmaku() {
            if (GM_getValue('MRMenuAlwaysDisableDnmaku').split('')[0] != '1') return;
            (function check() {
                if (document.getElementsByClassName('bui-danmaku-switch-input')[0]) {
                    var mode = GM_getValue('MRMenuAlwaysDisableDnmaku').split('');
                    var input = document.getElementsByClassName('bui-danmaku-switch-input')[0];
                    if (mode[1] == '1' && input.checked == false) input.click();
                    else if (mode[2] == '1' && input.checked == true) input.click();
                } else { setTimeout(check, 200); }
            })();
        }

        function loadReadyFunction() {
            (function check() {
                var ready = false;
                if (webStatus == 0) {
                    ready = !!(
                        document.querySelector('.bpx-player-ctrl-time-duration') &&
                        document.getElementById('viewbox_report') &&
                        document.querySelector('.up-panel-container') &&
                        document.querySelector('.bpx-player-sending-area')
                    );
                } else if (webStatus == 1 || webStatus == 3 || webStatus == 5 || webStatus == 6 || webStatus == 9) {
                    var inp = document.getElementsByClassName('nav-search-input')[0];
                    ready = !!(inp && inp.title != '');
                } else if (webStatus == 2) {
                    var w = document.getElementsByClassName('bpx-player-dm-wrap')[0];
                    ready = !!(w && w.textContent != '-');
                } else if (webStatus == 4) {
                    ready = !!document.getElementsByClassName('right-entry')[0];
                } else if (webStatus == 7) {
                    ready = !!document.getElementsByClassName('index-info')[0];
                } else if (webStatus == 8) {
                    ready = !!(document.getElementsByClassName('list-box')[0] || document.getElementsByClassName('load-state')[0]);
                }

                if (ready) {
                    setTimeout(function () {
                        console.log('[' + notificationScriptName + '-' + notificationNotification + '] 页面加载完毕');
                        loadReady = true;

                        var ps = document.getElementsByClassName('MRMenuOptionParent');
                        for (var i = 0; i < ps.length; i++) ps[i].setAttribute('mr_is_loaded', 'true');
                        var s = document.getElementById('MRMenuStatus');
                        if (s) s.textContent = '';

                        if (GM_getValue('MRPlayerMode') == 0 && GM_getValue('MRMenuMoveWindowToTop') == 1) {
                            moveWindowToTop();
                        }

                        if (GM_getValue('MRMenuMoveTitleAndUpinfo') == 1) {
                            moveTitleAndUpinfo();
                        }
                    }, 200);
                } else {
                    setTimeout(check, 200);
                }
            })();
        }
    }
})();
