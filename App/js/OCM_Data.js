//"use strict";

function OCM_LocationSearchParams() {
	this.countryCode = null;
	this.latitude = null;
	this.longitude = null;
	this.distance = null;
	this.distanceUnit = null;

	this.connectionTypeID = null;
	this.operatorID = null;
	this.levelID = null;
	this.countryID = null;
	this.usageTypeID = null;
	this.statusTypeID = null;
	this.submissionStatusTypeID = null;

	this.maxResults = 5000;
	this.additionalParams = null;
	this.includeComments = false;
	this.enableCaching = true;
}

function OCM_Data() {
	this.serviceBaseURL = "http://api.openchargemap.io/v2";
	//this.serviceBaseURL = "http://localhost:8080/v2";
}

OCM_Data.prototype.fetchLocationDataList = function (countrycode, lat, lon, distance, distanceunit, maxresults, includecomments, callbackname, additionalparams, errorcallback) {

	if (countrycode === null) countrycode = "";
	if (additionalparams === null) additionalparams = "";

	if (!errorcallback) errorcallback = this.handleGeneralAjaxError;

	$.ajax({
		type: "GET",
		url: this.serviceBaseURL + "/poi/?verbose=false&output=json&countrycode=" + countrycode + "&longitude=" + lon + "&latitude=" + lat + "&distance=" + distance + "&distanceunit=" + distanceunit + "&includecomments=" + includecomments + "&maxresults=" + maxresults + "&" + additionalparams + "&callback=" + callbackname,
		jsonp: false,
		contentType: "application/json;",
		dataType: "jsonp",
		crossDomain: true,
		error: errorcallback
	});
};

OCM_Data.prototype.fetchLocationDataListByParam = function (params, callbackname, errorcallback) {

	var serviceURL = this.serviceBaseURL + "/poi/?verbose=false&output=json";
	var serviceParams = "";
	if (params.countryCode != null) serviceParams += "&countrycode=" + params.countryCode;
	if (params.latitude != null) serviceParams += "&latitude=" + params.latitude;
	if (params.longitude != null) serviceParams += "&longitude=" + params.longitude;
	if (params.distance != null) serviceParams += "&distance=" + params.distance;
	if (params.distanceUnit != null) serviceParams += "&distanceunit=" + params.distanceUnit;
	if (params.includeComments != null) serviceParams += "&includecomments=" + params.includeComments;
	if (params.maxResults != null) serviceParams += "&maxresults=" + params.maxResults;
	if (params.countryID != null) serviceParams += "&countryid=" + params.countryID;
	if (params.levelID != null) serviceParams += "&levelid=" + params.levelID;
	if (params.connectionTypeID != null) serviceParams += "&connectiontypeid=" + params.connectionTypeID;
	if (params.operatorID != null) serviceParams += "&operatorid=" + params.operatorID;
	if (params.usageTypeID != null) serviceParams += "&usagetypeid=" + params.usageTypeID;
	if (params.statusTypeID != null) serviceParams += "&statustypeid=" + params.statusTypeID;
	if (params.submissionStatusTypeID != null) serviceParams += "&submissionstatustypeid=" + params.submissionStatusTypeID;

	if (params.enableCaching == false) serviceParams += "&enablecaching=false";
	if (params.additionalParams != null) serviceParams += "&" + params.additionalParams;

	if (!errorcallback) errorcallback = this.handleGeneralAjaxError;

	$.ajax({
		type: "GET",
		url: serviceURL + serviceParams + "&callback=" + callbackname,
		jsonp: false,
		contentType: "application/json;",
		dataType: "jsonp",
		crossDomain: true,
		error: errorcallback
	});
};

OCM_Data.prototype.fetchLocationById = function (id, callbackname, errorcallback) {
    var serviceURL = this.serviceBaseURL + "/poi/?output=json&includecomments=true&chargepointid=" + id;
    if (!errorcallback) errorcallback = this.handleGeneralAjaxError;

    $.ajax({
        type: "GET",
        url: serviceURL + "&callback=" + callbackname,
        jsonp: false,
        contentType: "application/json;",
        dataType: "jsonp",
        crossDomain: true,
        error: errorcallback
    });
};

OCM_Data.prototype.handleGeneralAjaxError = function (result, ajaxOptions, thrownError) {
	if (result.status == 200) {
		//all ok
	}
	else {
		alert("There was a problem transferring data. Please check your internet connection.");
	}
};

OCM_Data.prototype.fetchCoreReferenceData = function (callbackname) {

	$.ajax({
		type: "GET",
		url: this.serviceBaseURL + "/referencedata/?output=json&callback=" + callbackname,
		jsonp: false,
		contentType: "application/json;",
		dataType: "jsonp",
		crossDomain: true,
		error: this.handleGeneralAjaxError
	});
};

OCM_Data.prototype.getAuthParamsFromSessionInfo = function (authSessionInfo) {
	var authInfoParams = "";

	if (authSessionInfo != null) {
		if (authSessionInfo.Identifier != null) authInfoParams += "&Identifier=" + authSessionInfo.Identifier;
		if (authSessionInfo.SessionToken != null) authInfoParams += "&SessionToken=" + authSessionInfo.SessionToken;

		return authInfoParams;
	}
	return "";
};

OCM_Data.prototype.submitLocation = function (data, authSessionInfo, completedCallback, failureCallback) {

	var authInfoParams = this.getAuthParamsFromSessionInfo(authSessionInfo);

	var jsonString = JSON.stringify(data);

	$.ajax({
		type: "POST",
		url: this.serviceBaseURL + "/?action=cp_submission&format=json" + authInfoParams,
		data: jsonString,
		complete: function (jqXHR, textStatus) { completedCallback(jqXHR, textStatus); },
		error: this.handleGeneralAjaxError
	});
};

OCM_Data.prototype.submitUserComment = function (data, authSessionInfo, completedCallback, failureCallback) {

	var jsonString = JSON.stringify(data);

	$.ajax({
		type: "POST",
		url: this.serviceBaseURL + "/?action=comment_submission&format=json",
		data: jsonString,
		success: function (result, textStatus, jqXHR) { completedCallback(jqXHR, textStatus); },
		error: this.handleGeneralAjaxError
	});
};

OCM_Data.prototype.getRefDataByID = function (refDataList, id) {
	if (id != "") id = parseInt(id);

	if (refDataList != null) {
		for (var i = 0; i < refDataList.length; i++) {
			if (refDataList[i].ID == id) {
				return refDataList[i];
			}
		}
	}
	return null;
};

OCM_Data.prototype.sortCoreReferenceData = function() {
    //sort reference data lists
    this.sortReferenceData(this.referenceData.ConnectionTypes);
    this.sortReferenceData(this.referenceData.Countries);
    this.sortReferenceData(this.referenceData.Operators);
    this.sortReferenceData(this.referenceData.DataProviders);
    this.sortReferenceData(this.referenceData.UsageTypes);
    this.sortReferenceData(this.referenceData.StatusTypes);
    this.sortReferenceData(this.referenceData.CheckinStatusTypes);
};

OCM_Data.prototype.sortReferenceData = function (sourceList) {
	sourceList.sort(this.sortListByTitle);
};

OCM_Data.prototype.sortListByTitle = function (a, b) {
	if (a.Title < b.Title) return -1;
	if (a.Title > b.Title) return 1;
	if (a.Title == b.Title) return 0;

    return 0;
};

OCM_Data.prototype.isLocalStorageAvailable = function () {
	return typeof window.localStorage != 'undefined';
};

OCM_Data.prototype.setCachedDataObject = function (itemName, itemValue) {
	if (this.isLocalStorageAvailable()) {
		localStorage.setItem(itemName, JSON.stringify(itemValue));
	}
};

OCM_Data.prototype.getCachedDataObject = function (itemName) {
	if (this.isLocalStorageAvailable()) {
		var val = localStorage.getItem(itemName);
		if (val != null && val.length > 0) {
			return JSON.parse(val);
		}
	}
	return null;
};