// ==UserScript==
// @name         Roll20-Plus
// @namespace    https://github.com/kcaf
// @license      MIT (https://opensource.org/licenses/MIT)
// @version      v0.1.0-alpha
// @description  Roll20 Plus
// @author       kcaf
// @match        https://app.roll20.net/editor/
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

var Roll20Plus = function(version) {
    var d20plus = {
        sheet: "ogl",
        version: version
    };

    // Window loaded
    window.onload = function() {
        window.unwatch("d20");

        d20plus.log("> Force Load");
        window.d20ext.finalPageLoad();
        window.d20ext.finalPageLoad = function(){};

        d20plus.log("> Begin (" + d20plus.version + ")");

        d20plus.log("> Add Settings");
        $("#mysettings > .content").append(d20plus.settingsHtml);
        $("#mysettings > .content select.d20plus-sheet").on("change", d20plus.setSheet);

        // Firebase is going to deny your changes if you're not GM. Better to fail gracefully.
        if(window.is_gm) {
            d20plus.log("> Is GM");
        } else {
            d20plus.log("> Not GM. Exiting.");
            return;
        }

        d20plus.log("> Add CSS");
        _.each(d20plus.cssRules, function(r) {
            d20plus.addCSS(window.document.styleSheets[window.document.styleSheets.length-1], r.s, r.r);
        });

        d20plus.log("> Initiative Tracker");
        $("#initiativewindow .characterlist").before(d20plus.initiativeHeaders);
        $("#tmpl_initiativecharacter").replaceWith(d20plus.getInitTemplate());
        d20plus.hpAllowEdit();
    };

    // Create editable HP variable and autocalculate + or -
    d20plus.hpAllowEdit = function() {
        $("#initiativewindow").on("click", ".hp.editable", function() {
            if ($(this).find("input").length > 0)
                return void $(this).find("input").focus();
            var val = $.trim($(this).text());
            $(this).html("<input type='text' value='" + val + "'/>");
            $(this).find("input").focus();
        });
        $("#initiativewindow").on("keydown", ".hp.editable", function(event) {
            if (event.which == 13) {
                var total = 0, token, id, char, hp,
                    val = $.trim($(this).find("input").val()),
                    matches = val.match(/[+\-]*(\.\d+|\d+(\.\d+)?)/g) || [];
                while(matches.length){
                    total+= parseFloat(matches.shift());
                }
                token = $(this).parents("li.token");
                id = token.data("tokenid");
                char = d20.Campaign.pages.get(d20.Campaign.activePage()).thegraphics.get(id).character;
                hp = char.attribs.find(function(a){return a.get("name").toLowerCase() === "hp";});
                if(hp){
                    hp.syncedSave({
                        current: total
                    });
                } else {
                    char.attribs.create({
                        name: "hp",
                        current: total
                    });
                }
                d20.Campaign.initiativewindow._rebuildInitiativeList();
            }
        });
    };

    // Cross-browser add CSS rule
    d20plus.addCSS = function (sheet, selector, rules) {
        index = sheet.cssRules.length;
        if("insertRule" in sheet) {
            sheet.insertRule(selector + "{" + rules + "}", index);
        }
        else if("addRule" in sheet) {
            sheet.addRule(selector, rules, index);
        }
    };

    // Send string to chat using current char id
    d20plus.chatSend = function (str) {
        d20.textchat.doChatInput(str);
    };

    // Get character by name
    d20plus.charByName = function (name) {
        var char = null;
        d20.Campaign.characters.each(function(c) {
            if (c.get("name") == name) char = c;
        });
        return char;
    };

    // Prettier log
    d20plus.log = function (arg) {
        console.log("%cRoll20 Plus", "color: #3076b9; font-size: xx-large", arg);
    };

    // Return random integer between [0,int)
    d20plus.diceRandom = function (int) {
        return d20.textchat.diceengine.random(int);
    };

    // Change character sheet formulas
    d20plus.setSheet = function () {
        var r = /^[a-z]+$/,
            s = $(this).val().match(r)[0];
        d20plus.sheet = s in d20plus.formulas ? s : "ogl";
        $("#tmpl_initiativecharacter").replaceWith(d20plus.getInitTemplate());
        d20.Campaign.initiativewindow._rebuildInitiativeList();
    };

    // Return Initiative Tracker template with formulas
    d20plus.getInitTemplate = function() {
        var html = d20plus.initiativeTemplate;
        _.each(d20plus.formulas[d20plus.sheet], function(v,i) {
            html = html.replace("||"+i+"||", v);
        });
        return html;
    }

    /*  */
    d20plus.formulas = {
        ogl: {
            "AC": "@{ac}",
            "HP": "@{hp}",
            "PP": "@{passive_wisdom}"
        },
        community: {
            "AC": "@{AC}",
            "HP": "@{HP}",
            "PP": "10 + @{perception}"
        }
    };

    d20plus.settingsHtml = `<hr>
    <h3>Roll20 Plus ` + d20plus.version + `</h3>
    <p>
      <label>Select your character sheet</label>
      <select class="d20plus-sheet" style="width: 150px;">
        <option value="ogl">5th Edition ( OGL by Roll20 )</option>
        <option value="community">5th Edition (Community Contributed)</option>
      </select>
    </p>`;

    d20plus.cssRules = [
        {s: "#initiativewindow ul li span.initiative,#initiativewindow ul li span.ac,#initiativewindow ul li span.hp,#initiativewindow ul li span.pp",
            r: "font-size: 25px;font-weight: bold;text-align: right;float: right;padding: 5px;width: 10%;min-height: 20px;"},
        {s: "#initiativewindow ul li span.editable input",
            r: "width: 100%; box-sizing: border-box;height: 100%;"},
        {s: "#initiativewindow div.header",
            r: "height: 30px;"},
        {s: "#initiativewindow div.header span",
            r: "cursor: default;font-size: 15px;font-weight: bold;text-align: right;float: right;width: 10%;min-height: 20px;padding: 5px;"}
    ];

    d20plus.initiativeHeaders = `<div class="header">
      <span class="initiative" alt="Initiative" title="Initiative">Init</span>
      <span class="pp" alt="Passive Perception" title="Passive Perception">Pass</span>
      <span class="ac" alt="AC" title="AC">AC</span>
      <span class="hp" alt="HP" title="HP">HP</span>
    </div>`;

    d20plus.initiativeTemplate = `<script id="tmpl_initiativecharacter" type="text/html">
    <![CDATA[
      <li class='token <$ if(this.layer == "gmlayer") { $>gmlayer<$ } $>' data-tokenid='<$!this.id$>' data-currentindex='<$!this.idx$>'>
      <span alt='Initiative' title='Initiative' class='initiative <$ if(this.iseditable) { $>editable<$ } $>'>
      <$!this.pr$>
      </span>
      <$ var char = d20.Campaign.pages.get(d20.Campaign.activePage()).thegraphics.get(this.id).character; $>
      <span class='pp' alt='Passive Perception' title='Passive Perception'><$!char.autoCalcFormula('||PP||')$></span>
      <span class='ac' alt='AC' title='AC'><$!char.autoCalcFormula('||AC||')$></span>
      <span class='hp editable' alt='HP' title='HP'><$!char.autoCalcFormula('||HP||')$></span>
      <$ if(this.avatar) { $><img src='<$!this.avatar$>' /><$ } $>
      <span class='name'><$!this.name$></span>
      <div class='clear' style='height: 0px;'></div>
      <div class='controls'>
        <span class='pictos remove'>#</span>
      </div>
      </li>
    ]]>`;
    /*  */

    /* object.watch polyfill by Eli Grey, http://eligrey.com */
    if (!Object.prototype.watch) {
        Object.defineProperty(Object.prototype, "watch", {
            enumerable: false,
            configurable: true,
            writable: false,
            value: function (prop, handler) {
                var
                oldval = this[prop],
                newval = oldval,
                getter = function () {
                    return newval;
                },
                setter = function (val) {
                    oldval = newval;
                    return (newval = handler.call(this, prop, oldval, val));
                };

                if (delete this[prop]) {
                    Object.defineProperty(this, prop, {
                        get: getter,
                        set: setter,
                        enumerable: true,
                        configurable: true
                    });
                }
            }
        });
    }

    if (!Object.prototype.unwatch) {
        Object.defineProperty(Object.prototype, "unwatch", {
            enumerable: false,
            configurable: true,
            writable: false,
            value: function (prop) {
                var val = this[prop];
                delete this[prop];
                this[prop] = val;
            }
        });
    }
    /* end object.watch polyfill */

    window.d20ext = {};
    window.watch("d20ext", function (id, oldValue, newValue) {
        d20plus.log("> Set Development");
        newValue.environment = "development";
        return newValue;
    });

    window.d20 = {};
    window.watch("d20", function (id, oldValue, newValue) {
        d20plus.log("> Obtained d20 variable");
        window.unwatch("d20ext");
        window.d20ext.environment = "production";
        newValue.environment = "production";
        return newValue;
    });

    d20plus.log("> Injected");
};

// Inject
if(window.top == window.self)
    unsafeWindow.eval("(" + Roll20Plus.toString() + ")('" + GM_info.script.version + "')");