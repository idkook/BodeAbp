﻿(function ($) {
    $.bode = $.bode || { version: 1.0, vtime: (new Date().getTime()) };
})(jQuery);

(function ($) {
    $.bode.grid = function (selector, conf) {
        this.tab = $(selector);
        this.conf = conf || {};
        this.columnsHash = {};
        this.columns = conf.columns || []; //列配置
        this.isBatch = conf.isBatch || false; //是否允许批量操作
        this.originData = this.conf.data || []; //初始数据
        this.actions = this.conf.actions || []; //右上角操作按钮
        this.extraFilters = this.conf.extraFilters || []; //外部查询条件
        this.imgSaveUrl = this.conf.imgSaveUrl || $.bode.config.imgSaveUrl;
        this.formId = this.conf.formId || "bode-grid-autoform"; //表单id
        this.actionsContainerId = this.conf.actionsContainerId || "actionArea";
        this.isFormInited = false; //表单是否初始化
        this.formWidth = this.conf.formWidth || "40%";
        this.curEditId = 0; //当前编辑数据的Id
        this.queryParams = {
            pageIndex: conf.pageIndex || 1,
            pageSize: conf.pageSize || 15,
            sortConditions: [
	            { //默认按Id倒序
	                sortField: conf.sortField || "id",
	                listSortDirection: conf.listSortDirection === 0 ? 0 : 1
	            }
            ],
            filterGroup: []
        }
        this.searchOperators = {
            common: [{ val: "equal", text: "等于" }, { val: "notequal", text: "不等于" }],
            struct: [
	            { val: "less", text: "小于" }, { val: "lessorequal", text: "小于等于" }, { val: "greater", text: "大于" },
	            { val: "greaterorequal", text: "大于等于" }
            ],
            text: [{ val: "contains", text: "包含" }, { val: "startswith", text: "开始于" }, { val: "endswith", text: "结束于" }]
        };

        this.beforeInit = this.conf.beforeInit || function () { };
        this.initComplete = this.conf.initComplete || function () { };
        this.loadDataComplete = this.conf.loadDataComplete || function () { };

        //工具方法
        this.tool = {
            //数据展示render
            render: function (v, d, r) {
                if (v == null) return "";
                if (typeof (r) == 'function') return r(v, d);
                return v;
            },
            //dropdown与switch显示render
            sourceRender: function (v, source, r) {
                if (typeof (r) == 'function') return r(v);
                else {
                    var valueFiled = source.valueField || "value";
                    var textField = source.textField || "text";
                    for (var i = 0, sLen = source.data.length; i < sLen; i++) {
                        if (source.data[i][valueFiled].toString() === v.toString()) {
                            return source.data[i][textField];
                        }
                    }
                    return v;
                }
            }
        }

        var editorHash = {};
        this.initForm = function () {
            var form = $('<form id="' + this.formId + '" class="form-horizontal layer-row-container" role="form"></form>');
            form.appendTo($("body"));

            for (var i = 0, iLen = this.columns.length; i < iLen; i++) {
                var colType = this.columns[i]["type"];
                if (!colType) continue;
                var row;
                if (["text", "number", "datepicker", "timepicker", "hide"].indexOf(colType) >= 0) {
                    row = $('<div class="form-group"><label for="' +
	                    this.columns[i]["data"] +
	                    '" class="col-sm-3 control-label">' +
	                    this.columns[i]["title"] +
	                    '：</label><div class="col-sm-9"><input type="text" class="form-control" id="' +
	                    this.columns[i]["data"] +
	                    '"></div></div>');
                    if (colType === "number") {
                        $.bode.tools.input.formatDiscount(row.find("#" + this.columns[i]["data"]));
                    } else if (colType === "datepicker" || colType === "timepicker") {
                        var showTime = colType === "timepicker";
                        $.bode.tools.input.formatTime(row.find("#" + this.columns[i]["data"]), showTime);
                    } else if (colType === "hide") {
                        row.hide();
                    }
                    row.appendTo(form);
                } else if (["switch", "dropdown"].indexOf(colType) >= 0) {
                    var source = this.columns[i]["source"];
                    var valueFiled = source.valueField || "value";
                    var textField = source.textField || "text";
                    row = $('<div class="form-group"><label for="' +
	                    this.columns[i]["data"] +
	                    '"  class="col-sm-3 control-label">' +
	                    this.columns[i]["title"] +
	                    '：</label><div class="col-sm-9"><select class="form-control" id="' +
	                    this.columns[i]["data"] +
	                    '"></select></div></div>');
                    var select = row.find("#" + this.columns[i]["data"]);
                    for (var j = 0, jLen = source["data"].length; j < jLen; j++) {
                        var option = source["data"][j];
                        $('<option value="' +
	                            option[valueFiled] +
	                            '">' +
	                            option[textField
                        ] +
	                            '</option>')
	                        .appendTo(select);
                    }
                    row.appendTo(form);
                } else if (colType === "img") {
                    row = $('<div class="form-group"><label for="' +
	                    this.columns[i]["data"] +
	                    '"  class="col-sm-3 control-label">' +
	                    this.columns[i]["title"] +
	                    '：</label><div class="col-sm-9"><div class="uploader-list"><div class="file-item thumbnail"><img style="width:160px;height:90px;" id="img_' +
	                    this.columns[i]["data"] +
	                    '" src="" /></div></div><div id="' +
	                    this.columns[i]["data"] +
	                    '">选择图片</div></div></div>');
                    row.appendTo(form);
                    // 初始化Web Uploader
                    var uploader = WebUploader.create({
                        auto: true, // 选完文件后，是否自动上传。
                        swf: '/Content/js/plugs/webuploader/Uploader.swf', // swf文件路径
                        server: this.imgSaveUrl, // 文件接收服务端。
                        // 选择文件的按钮。可选。
                        // 内部根据当前运行是创建，可能是input元素，也可能是flash.
                        pick: '#' + this.columns[i]["data"],

                        // 只允许选择图片文件。
                        accept: {
                            title: 'Images',
                            extensions: 'gif,jpg,jpeg,bmp,png',
                            mimeTypes: 'image/*'
                        }
                    });
                    uploader.on("uploadSuccess",
	                    function (file, resp) {
	                        $("#img_" + this.options.pick.substring(1)).attr("src", resp);
	                    });
                } else if (colType === "textarea") {
                    row = $('<div class="form-group"><label for="' +
	                    this.columns[i]["data"] +
	                    '"  class="col-sm-3 control-label">' +
	                    this.columns[i]["title"] +
	                    '：</label><div class="col-sm-9"><textarea class="form-control" id="' +
	                    this.columns[i]["data"] +
	                    '" style="overflow: hidden; word-wrap: break-word; resize: horizontal; height: 48px;"></textarea></div></div>');
                    row.appendTo(form);
                    row.find('textarea').autosize({ append: "\n" });
                } else if (colType === "richtext") {
                    row = $('<div class="form-group"><label for="' +
	                    this.columns[i]["data"] +
	                    '"  class="col-sm-3 control-label">' +
	                    this.columns[i]["title"] +
	                    '：</label><div class="col-sm-9"><textarea class="form-control" id="' +
	                    this.columns[i]["data"] +
	                    '" style="heght:150px;"></textarea></div></div>');
                    row.appendTo(form);

                    var editor = new wangEditor(this.columns[i]["data"]);
                    editor.config.uploadImgUrl = this.imgSaveUrl;
                    editor.config.withCredentials = false;

                    editor.create();
                    editorHash[this.columns[i]["data"]] = editor;
                }
            }
            $('<hr class="wide" />').appendTo(form);
            this.isFormInited = true;
        }

        this.popupForm = function (d, p) {
            var self = p || this;
            if (!self.isFormInited) {
                self.initForm();
            }
            var data = d || {};
            if (data.id !== self.curEditId) {
                self.curEditId = data.id || 0;

                for (var i = 0, iLen = self.columns.length; i < iLen; i++) {
                    var colType = self.columns[i]["type"];
                    if (!colType) continue;

                    var dataField = self.columns[i]["data"];
                    var curValue = typeof (data[dataField]) === "undefined" || data[dataField] == null
	                    ? ""
	                    : data[dataField].toString();

                    if (["text", "number", "hide", "datepicker", "timepicker", "switch", "dropdown", "textarea"]
	                    .indexOf(colType) >=
	                    0) {
                        $("#" + dataField).val(curValue);
                    } else if (colType === "img") {
                        $("#img_" + dataField).attr("src", curValue);
                    } else if (colType === "richtext") {
                        self.formWidth = "60%";

                        var richeditor = editorHash[self.columns[i]["data"]];
                        richeditor.$txt.html(curValue);
                    }

                    //处理新增、编辑模式下字段的可编辑性
                    var fieldPatten = "";
                    var editor = self.columns[i]["editor"];
                    if (!editor) continue;
                    fieldPatten = self.curEditId === 0 ? editor.ap : editor.ep;
                    if (fieldPatten === "hide") {
                        $("#" + dataField).closest(".form-group").hide();
                    } else {
                        $("#" + dataField).closest(".form-group").show();
                    }

                    if (fieldPatten === "disabled") {
                        $("#" + dataField).attr("disabled", true);
                    } else {
                        $("#" + dataField).attr("disabled", false);
                    }
                }
            }

            layer.open({
                title: self.curEditId === 0 ? "新增" : "编辑",
                type: 1,
                area: self.formWidth,
                content: $("#" + self.formId),
                zIndex: 9999,
                btn: ["保存", "取消"],
                yes: function (index, layero) {
                    self.submitForm(function () {
                        self.reload();
                        layer.close(index);
                    });
                },
                cancel: function () { }
            });
        }

        this.submitForm = function (callback) {
            var data = { id: this.curEditId };
            for (var i = 0, iLen = this.columns.length; i < iLen; i++) {
                var colType = this.columns[i]["type"];
                if (!colType) continue;

                var dataField = this.columns[i]["data"];
                if (["text", "number", "datepicker", "timepicker", "hide", "switch", "dropdown", "textarea"]
	                .indexOf(colType) >=
	                0) {
                    data[dataField] = $("#" + dataField).val();
                } else if (colType === "img") {
                    data[dataField] = $("#img_" + dataField).attr("src");
                } else if (colType === "richtext") {
                    var richeditor = editorHash[dataField];
                    data[dataField] = richeditor.$txt.html();
                }
            }

            //添加额外属性
            for (var j = 0, jLen = this.extraFilters.length; j < jLen; j++) {
                var filter = this.extraFilters[j];
                if (filter.operate !== "equal") continue;
                data[filter.field] = filter.value;
            }
            var url = this.curEditId === 0 ? this.conf.url.add : this.conf.url.edit;

            abp.ajax({
                url: url,
                type: "POST",
                data: JSON.stringify(data),
                success: function () {
                    callback();
                    abp.notify.success("保存成功");
                }
            });
            this.curEditId = 0;
        }

        this.loadData = function () {
            var actionClick = function (e) {
                var action = e.data.action;
                var data = e.data.data;
                action.onClick(data, e.data.tab);
            };

            //加载表格
            for (var i = 0, n = this.originData.length; i < n; i++) {
                var d = this.originData[i];
                var tr = $('<tr></tr>');
                if (this.isBatch) {
                    $('<td style="width:10px;padding:8px 0 0 5px"><div class="checkbox"><label><input type="checkbox" value="' + d["id"] + '"><span class="text"></span></label></div></td>').appendTo(tr);
                }
                for (var j = 0, m = this.columns.length; j < m; j++) {
                    var r = this.columns[j]["render"];
                    var colType = this.columns[j]["type"];
                    var display = colType === "hide" || this.columns[j].visible === "none"
	                        ? 'style="display:none;"'
	                        : '';
                    var v = d[this.columns[j]["data"]];
                    if (colType === "dropdown" || colType === "switch") {
                        var source = this.columns[j].source;
                        $('<td ' + display + '>' + this.tool.sourceRender(v, source, this.columns[j]["render"]) + '</td>').appendTo(tr);
                    } else if (colType === "img" && v) {
                        $('<td ' + display + '><img src="' + v + '" style="width:120px;height:80px;" data-action="zoom"/></td>')
	                        .appendTo(tr);
                    } else if (colType === "datepicker" || colType === "timepicker") {
                        if (!v) {
                            $('<td ' + display + '></td>').appendTo(tr);
                        } else {
                            var date = new Date(v);
                            var format = colType === "datepicker" ? "yyyy-MM-dd" : "yyyy-MM-dd hh:mm";
                            $('<td ' + display + '>' + $.bode.tools.timeFormat(date, format) + '</td>').appendTo(tr);
                        }
                    } else if (colType === "command") {
                        var self = this;
                        var td = $('<td ' + display + '></td>');
                        for (var k = 0, sIndex = 0, kLen = this.columns[j].actions.length; k < kLen; k++) {
                            var action = this.columns[j].actions[k];
                            if (action.hideFunc && action.hideFunc(d)) continue;
                            if (action.permission && !abp.auth.isGranted(action.permission)) continue;

                            if (sIndex++ > 0) td.append(' - ');
                            var actionName = action.getName ? action.getName(d) : action.name;
                            $('<a href="#"> ' + actionName + '</a>')
	                            .bind("click", { action: action, data: d, tab: self }, actionClick)
	                            .appendTo(td);
                        }
                        td.appendTo(tr);
                    } else {
                        if (v == null) v = "";
                        if (r) {
                            $('<td ' + display + '>' + this.tool.render(v, d, r) + '</td>').appendTo(tr);
                        } else {
                            var maxLength = this.columns[j]["maxLength"] || 20;
                            var title = " title='" + v + "'";
                            var content = typeof (v) === "string" && v.length > maxLength
	                            ? v.substring(0, maxLength) + "..."
	                            : v;
                            $('<td ' + display + title + '>' + content + '</td>').appendTo(tr);
                        }
                    }
                }
                tr.appendTo(this.tab.find("tbody"));
            }
        }

        this.initPermission = function () {
            if (typeof (this.conf.permission) === "string" && this.conf.permission) {
                var permission = this.conf.permission;
                this.conf.permission = {
                    add: permission + ".add",
                    edit: permission + ".update",
                    delete: permission + ".delete",
                };
            }
        }

        this.initHead = function () {
            var tab = this;
            if (tab.isBatch) {
                var th =
	                $('<th style="width:10px;padding:0 0 5px 5px"><div class="checkbox"><label><input type="checkbox"><span class="text"></span></label></div></th>')
                th.find("input:checkbox")
	                .click(function () {
	                    if ($(this).is(":checked")) {
	                        tab.tab.find("tbody>tr").find("td:eq(0) input:checkbox").not("input:checked").click();
	                    } else {
	                        tab.tab.find("tbody>tr").find("td:eq(0) input:checkbox").removeAttr("checked");
	                    }
	                });
                th.appendTo(this.tab.find("thead>tr"));
            }

            //初始化columnHash与表头
            for (var i = 0, n = this.columns.length; i < n; i++) {
                //初始化switch的数据源
                var colType = this.columns[i]["type"];
                //初始化switch的format与数据源
                if (colType === "switch" && typeof (this.columns[i]["source"]) === "undefined") {
                    this.columns[i]["source"] = {
                        data: [{ "value": "false", "text": "否" }, { "value": "true", "text": "是" }]
                    };
                }
                //初始化command的编辑和删除action
                if (colType === "command") {
                    var columnActions = this.columns[i]["actions"] || [];
                    if (this.conf.url.edit) {
                        columnActions.unshift({
                            name: "编辑",
                            permission: this.conf.permission.edit || "",
                            onClick: function (d, self) {
                                tab.popupForm(d, self);
                            }
                        });
                    }
                    if (this.conf.url.delete) {
                        columnActions.push({
                            name: "删除",
                            permission: this.conf.permission.delete || "",
                            onClick: function (d) {
                                var confirmIndex = layer.confirm('是否确定删除该数据？此操作是不可恢复的。',
	                                {
	                                    btn: ['确定', '取消'] //按钮
	                                },
	                                function () {
	                                    abp.ajax({
	                                        url: tab.conf.url.delete + "?id=" + d.id,
	                                        type: "POST",
	                                        data: JSON.stringify({ id: d.id }),
	                                        success: function () {
	                                            tab.query();
	                                            layer.close(confirmIndex);
	                                            abp.notify.success("删除成功");
	                                        }
	                                    });
	                                });
                            }
                        });
                    }
                    this.columns[i]["actions"] = columnActions;
                }

                //将列的data字段统一转换为驼峰式命名法
                this.columns[i].data = $.bode.tools.toCamelCase(this.columns[i].data);
                //初始化columnHash
                this.columnsHash[this.columns[i].data] = this.columns[i];
                var display = colType === "hide" || this.columns[i].visible === "none" ? 'style="display:none;"' : '';
                var sortHtml = this.columns[i].sortDisable ? '' : ' class="sorting"';
                var width = this.columns[i].width || '251px';
                $('<th ' +
	                    display +
	                    sortHtml +
	                    ' data-key="' +
	                    this.columns[i].data +
	                    '" style="width: ' +
	                    width +
	                    ';">' +
	                    this.columns[i].title +
	                    '</th>')
	                .click(function () {
	                    if (typeof ($(this).attr("class")) == "undefined") return;
	                    var sortDirection = $(this).attr("class") === "sorting_asc" ? 0 : 1;
	                    tab.queryParams.sortConditions = [
	                        {
	                            sortField: $(this).attr("data-key"),
	                            listSortDirection: sortDirection
	                        }
	                    ];
	                    $(".sorting_asc,.sorting_desc").attr("class", "sorting");

	                    tab.query();
	                    var className = sortDirection === 0 ? "sorting_desc" : "sorting_asc";
	                    $(this).attr("class", className);
	                })
	                .appendTo(this.tab.find("thead>tr"));
            }
        }

        this.initAction = function () {
            var self = this;
            if (self.conf.url.add) {
                self.actions.push({
                    name: "新增",
                    icon: "fa-plus",
                    permission: self.conf.permission.add || "",
                    btnClass: "btn-palegreen",
                    onClick: function () {
                        self.popupForm();
                        return false;
                    }
                });
            }
            self.actions.push({
                name: "查询",
                icon: "fa-search",
                btnClass: "btn-info",
                onClick: function () {
                    var filter = { rules: [] };
                    self.tab.closest("div")
	                    .find(".col-sm-4")
	                    .each(function () {
	                        filter.rules.push({
	                            field: $(this).find("select:eq(0)").select2("val"),
	                            operate: $(this).find("select:eq(1)").select2("val"),
	                            value: $(this).find(".query-input").val()
	                        });
	                    });

                    self.queryParams.pageIndex = 1;
                    self.queryParams.filterGroup = filter;
                    self.query();
                }
            });

            for (var i = 0, iLen = self.actions.length; i < iLen; i++) {
                var action = self.actions[i];
                if (action.permission && !abp.auth.isGranted(action.permission)) continue;

                var iconHtml = action.icon ? '<span class="fa ' + action.icon + '" aria-hidden="true"></span>' : '';
                var actionObj = $('<div class="pull-right" style="margin-right: 10px;"><button class="btn ' +
	                action.btnClass +
	                '">' +
	                iconHtml +
	                action.name +
	                '</button></div>');
                actionObj.find("button").bind("click", {}, action.onClick);
                actionObj.appendTo($("#" + self.actionsContainerId));
            }
        }

        this.initFoot = function (total) {
            var tab = this;

            //初始化分页控件
            var pageDom = $('<div class="row DTTTFooter"></div>');
            $('<div class="col-sm-2"><div class="dataTables_info">共' +
	                total +
	                '条记录</div></div>' +
	                '<div class="col-sm-10"><div class="dataTables_paginate paging_bootstrap"><ul class="pagination"></ul></div></div>')
	            .appendTo(pageDom);

            var gIndex;
            var cIndex = tab.queryParams.pageIndex;
            var pageCount = Math.ceil(total / this.queryParams.pageSize);
            var ul = pageDom.find("ul");
            var prevHtml = this.queryParams.pageIndex === 1 ? " disabled" : "";

            $('<li class="prev' + prevHtml + '"><a href="#">上一页</a></li>')
	            .click(function () {
	                $(this).closest("ul").find(".active").prev("li").click();
	            })
	            .appendTo(ul);

            //计算显示的最大页序号
            if (pageCount <= 5 || pageCount - 2 <= cIndex) {
                gIndex = pageCount;
            } else {
                gIndex = cIndex < 3 ? 5 : cIndex + 2;
            }
            for (var i = gIndex - 4 > 1 ? gIndex - 4 : 1; i <= gIndex; i++) {
                var activeHtml = i === tab.queryParams.pageIndex ? ' class="active"' : '';
                $('<li' + activeHtml + '><a href="#">' + i + '</a></li>')
	                .click(function () {
	                    if ($(this).hasClass("active")) return;
	                    var index = parseInt($(this).text());
	                    tab.queryParams.pageIndex = index;
	                    tab.query();
	                })
	                .appendTo(ul);
            }

            var nextHtml = cIndex === pageCount ? " disabled" : "";
            $('<li class="next' + nextHtml + '"><a href="#">下一页</a></li>')
	            .click(function () {
	                $(this).closest("ul").find(".active").next("li").click();
	            })
	            .appendTo(ul);
            pageDom.appendTo(this.tab.closest("div"));
        }

        this.initData = function () {
            var tab = this;
            if (tab.isBatch) {
                tab.tab.find(">thead>tr>th:eq(0)").find("input:checkbox:checked").click();
            }
            //初始化数据
            if (typeof (tab.conf.url.read) != "undefined") {
                var queryFilters = tab.queryParams.filterGroup.rules || [];
                var query = {
                    pageIndex: tab.queryParams.pageIndex,
                    pageSize: tab.queryParams.pageSize,
                    sortConditions: tab.queryParams.sortConditions,
                    filterGroup: {
                        rules: queryFilters.concat(tab.extraFilters)
                    }
                }
                abp.ajax({
                    url: tab.conf.url.read,
                    type: "POST",
                    data: JSON.stringify(query),
                    success: function (data) {
                        tab.originData = data.items;
                        tab.loadData();

                        //绑定分页控件
                        tab.initFoot(data.totalCount);
                        tab.loadDataComplete(data);
                    }
                });
            } else {
                this.loadData();
                this.initFoot(this.originData.length);
                this.loadDataComplete(this.originData);
            }
        }

        this.initSearch = function () {
            var self = this;
            var initOperatorSelect = function (type, el) {
                var selectObj = $(el).closest("div").find("select:eq(1)");
                var opraArr = self.searchOperators.common.concat([]);
                //改变操作选项
                if (type === "number" || type === "datepicker" || type === "timepicker") {
                    opraArr = opraArr.concat(self.searchOperators.struct);
                }
                if (type === "text" || type === "textarea") {
                    opraArr = opraArr.concat(self.searchOperators.text);
                }

                selectObj.empty();
                for (var i = 0, n = opraArr.length; i < n; i++) {
                    $('<option value="' + opraArr[i].val + '">' + opraArr[i].text + '</option>').appendTo(selectObj);
                }
                selectObj.select2("val", opraArr[0].val);
            }
            var initValueField = function (type, evnt, el) {
                var valueObj = $(el).closest("div").find(".query-input");

                //移除值下拉选择框
                if ($(el).closest("div").find(".select2-container").length === 3) {
                    $(el).closest("div").find(".select2-container").eq(2).remove();
                }
                //去掉日期选择事件
                valueObj.datetimepicker('remove');

                //对switch与dropdown选项的值进行处理
                if (type === "dropdown" || type === "switch") {
                    var source = self.columnsHash[evnt.target.value].source;
                    var valueFiled = source.valueField || "value";
                    var textField = source.textField || "text";

                    valueObj.hide();
                    var valueSelect = $('<select data-type="dropdown" style="width:30%;margin-left:4px;"></select>')
	                    .on("change",
	                        function () {
	                            //值存到input框中
	                            $(this).closest("div").find(".query-input").val($(this).select2("val"));
	                        });

                    for (var i = 0, n = source.data.length; i < n; i++) {
                        $('<option value="' + source.data[i][valueFiled] + '">' + source.data[i][textField] + '</option>')
	                        .appendTo(valueSelect);
                    }
                    $(el).closest("div").find("a.btn").before(valueSelect);
                    valueSelect.select2().change();
                } else if (type === "datepicker" || type === "timepicker") {
                    valueObj.val("").show();
                    var showTime = type === "timepicker";
                    $.bode.tools.input.formatTime(valueObj, showTime);
                } else {
                    valueObj.val("").show();
                }
            }

            var fieldSelect = self.tab.closest("div").find(".row:eq(0)").find("select:eq(0)");
            for (var i = 0; i < self.columns.length; i++) {
                if (self.columns[i].query) {
                    $('<option value="' + self.columns[i].data + '">' + self.columns[i].title + '</option>')
	                    .appendTo(fieldSelect);
                }
            }
            fieldSelect.select2({
                //去掉搜索框
                minimumResultsForSearch: -1
            })
	            .on("change",
	                function (e) {
	                    var type = self.columnsHash[e.target.value].type;
	                    initOperatorSelect(type, this);
	                    initValueField(type, e, this);
	                })
	            .change();

            this.tab.closest("div")
	            .find(".row:eq(0)")
	            .find("select:eq(1)")
	            .select2({
	                //去掉搜索框
	                minimumResultsForSearch: -1
	            });

            //初始化搜索条件新增事件
            self.tab.closest("div")
	            .find("div.row:eq(0)")
	            .find("a.btn")
	            .click(function () {
	                var count = self.tab.closest("div").find("div.col-sm-4").length;
	                var row;

	                if (count % 3 === 1) {
	                    row = $('<div class="row" style="padding-bottom:10px;">');
	                    self.tab.before(row);
	                } else {
	                    row = self.tab.closest("div").find("div.row:eq(-2)");
	                }
	                var nSearch = $('<div class="col-sm-4"></div>').appendTo(row);

	                var options = $(this).closest("div").find("select:eq(0)").html();
	                var fieldSelect = $('<select style="width:25%">' + options + '</select>')
	                    .appendTo(nSearch)
	                    .select2({
	                        //去掉搜索框
	                        minimumResultsForSearch: -1
	                    })
	                    .on("change",
	                        function (e) {
	                            var type = datatable.columnsHash[e.target.value].type;
	                            initOperatorSelect(type, this);
	                            initValueField(type, e, this);
	                        });

	                $('<select style="width:25%;margin-left:4px;"></select>')
	                    .appendTo(nSearch)
	                    .select2({
	                        //去掉搜索框
	                        minimumResultsForSearch: -1
	                    });
	                $('<input type="text" class="query-input" style="margin-left:4px;">').appendTo(nSearch);
	                $('<a class="btn btn-warning btn-sm icon-only" href="javascript:void(0);" style="margin-left:4px;"><i class="fa fa-minus-square-o"></i></a>')
	                    .on("click",
	                        function () {
	                            if ($(this).closest(".row").find(".col-sm-4").length === 1) {
	                                $(this).closest(".row").remove();
	                            } else {
	                                $(this).closest(".col-sm-4").remove();
	                            }
	                        })
	                    .appendTo(nSearch);
	                //初始化
	                fieldSelect.change();
	            });
        }

        //初始化
        this.init = function () {
            this.beforeInit();

            this.initPermission();

            //初始化switch的数据源
            //初始化columnHash与表头
            this.initHead();

            //初始化操作按钮
            this.initAction();

            //初始化数据
            this.initData();

            //初始化查询控件
            this.initSearch();

            this.initComplete();
        }

        this.reload = function () {
            this.queryParams = {
                pageIndex: conf.pageIndex || 1,
                pageSize: conf.pageSize || 15,
                sortConditions: [
	                { //默认按Id倒序
	                    sortField: conf.sortField || "id",
	                    listSortDirection: conf.listSortDirection === 0 ? 0 : 1
	                }
                ],
                filterGroup: [{}]
            }
            this.query();
        }

        this.query = function () {
            this.tab.find("tbody").empty();
            this.tab.parent().find(".DTTTFooter").remove();
            this.initData();
        }

        this.setExtraFilter = function (extraFilter) {
            if (!extraFilter.field || !extraFilter.operate) return;
            var newFilters = [];
            for (var i = 0, iLen = this.extraFilters.length; i < iLen; i++) {
                var filter = this.extraFilters[i];
                if (filter.field === treeOption.tableParamField) continue;
                newFilters.push(filter);
            }
            newFilters.push(extraFilter);
            this.extraFilters = newFilters;
            this.reload();
        }

        this.getCheckedValues = function () {
            var checkDatas = [];
            if (this.isBatch) {
                var originDatas = this.originData;
                this.tab.find("tbody input:checkbox:checked")
	                .each(function () {
	                    var index = $(this).closest('tr').index();
	                    checkDatas.push(originDatas[index]);
	                });
            }
            return checkDatas;
        }

        //执行初始化
        this.init();
    };
})(jQuery);