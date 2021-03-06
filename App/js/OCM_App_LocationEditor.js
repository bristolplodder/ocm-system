
OCM_App.prototype.initEditors = function () {
    this.editorMapInitialised = false;

    var editorSubmitMethod = $.proxy(this.performLocationSubmit, this);

    $("#editlocation-form").validate({
        rules: {
            edit_addressinfo_title: {
                required: true,
                email: true
            }
        },
        submitHandler: function (form) {
            editorSubmitMethod();
        }
    });

    //fetch editor reference data
    this.ocm_data.referenceData = this.ocm_data.getCachedDataObject("CoreReferenceData");
    if (this.ocm_data.referenceData == null) {
        //no cached reference data, fetch from service
        this.ocm_data.fetchCoreReferenceData("ocm_app.populateEditor", this.getLoggedInUserInfo());
    } else {
        //cached ref data exists, use that
        this.logEvent("Using cached reference data..");
        var _app = this;
        setTimeout(function () { _app.populateEditor(); }, 50);

        //attempt to fetch fresh data later (wait 1 second)
        setTimeout(function () { _app.ocm_data.fetchCoreReferenceData("ocm_app.populateEditor", _app.getLoggedInUserInfo()); }, 1000);
    }
};

OCM_App.prototype.resetEditorForm = function () {
    //init editor to default settings

    document.getElementById("editlocation-form").reset();
    for (var n = 1; n <= this.numConnectionEditors; n++) {
        //create editor section
        this.setDropdown("edit_connection" + n + "_connectiontype", "0");
        this.setDropdown("edit_connection" + n + "_level", "");
        this.setDropdown("edit_connection" + n + "_status", "0");
        this.setDropdown("edit_connection" + n + "_currenttype", "");
    }

    this.setDropdown("edit_addressinfo_countryid", 1);
    this.setDropdown("edit_operator", 1);
    this.setDropdown("edit_dataprovider", 1);
    this.setDropdown("edit_submissionstatus", 1);
    this.setDropdown("edit_statustype", 50); //operational
};

OCM_App.prototype.populateEditor = function (refData) {

    ocm_app.hideProgressIndicator();

    //todo:move this into OCM_Data then pass to here from callback
    if (refData == null) {
        //may be loaded from cache
        refData = this.ocm_data.referenceData;
    } else {
        //store cached ref data
        if (refData != null) {
            this.ocm_data.setCachedDataObject("CoreReferenceData", refData);
            this.logEvent("Updated cached CoreReferenceData.");
        }
    }

    this.ocm_data.referenceData = refData;
    this.ocm_data.sortCoreReferenceData();
    refData = this.ocm_data.referenceData;
    //

    this.isLocationEditMode = false;

    //populate location editor dropdowns etc
    this.populateDropdown("edit_addressinfo_countryid", refData.Countries, null);
    this.populateDropdown("edit_usagetype", refData.UsageTypes, null);
    this.populateDropdown("edit_statustype", refData.StatusTypes, null);
    this.populateDropdown("edit_operator", refData.Operators, 1);

    //populate connection editor(s)
    for (var n = 1; n <= this.numConnectionEditors; n++) {
        //create editor section
        var $connection = ($("#edit_connection" + n));
        if (!$connection.length > 0) {
            //create new section using section 1 as template
            var templateHTML = $("#edit_connection1").html();
            if (templateHTML != null) {
                templateHTML = templateHTML.replace("Equipment Details 1", "Equipment Details " + n);
                templateHTML = templateHTML.replace(/connection1/gi, "connection" + n);

                $connection = $("<div id=\"edit_connection" + n + "\" class='panel panel-default'>" + templateHTML + "</div>");
                $("#edit-connectioneditors").append($connection);
            }
        }

        //populate dropdowns
        this.populateDropdown("edit_connection" + n + "_connectiontype", refData.ConnectionTypes, null);
        this.populateDropdown("edit_connection" + n + "_level", refData.ChargerTypes, null, true);
        this.populateDropdown("edit_connection" + n + "_status", refData.StatusTypes, null);
        this.populateDropdown("edit_connection" + n + "_currenttype", refData.CurrentTypes, null, true);


        //collapse additional editors by default
        //$connection.collapse();
        
        if (n==1)
        {
            $connection.collapse("show");
        }
    }

    //setup geocoding lookup of address in editor
    var appContext = this;
    $("#edit-location-lookup").fastClick(function (event, ui) {
        var lookupString =
			$("#edit_addressinfo_addressline1").val() + ", " +
			$("#edit_addressinfo_addressline2").val() + "," +
			$("#edit_addressinfo_town").val() + ", " +
			$("#edit_addressinfo_postcode").val() + "," +
			appContext.ocm_data.getRefDataByID(refData.Countries, $("#edit_addressinfo_countryid").val()).Title;

        appContext.ocm_geo.determineGeocodedLocation(lookupString, $.proxy(appContext.populateEditorLatLon, appContext));
    });

    //populate user comment editor
    this.populateDropdown("comment-type", refData.UserCommentTypes, null);
    this.populateDropdown("checkin-type", refData.CheckinStatusTypes, null);

    //populate and hide non-edit mode items: submission status etc by default
    this.populateDropdown("edit_submissionstatus", refData.SubmissionStatusTypes, 1);
    this.populateDropdown("edit_dataprovider", refData.DataProviders, 1);

    $("#edit-submissionstatus-container").hide();
    $("#edit-dataprovider-container").hide();

    //populate lists in filter/prefs/about page
    this.populateDropdown("filter-connectiontype", refData.ConnectionTypes, "", true, false, "(All)");
    this.populateDropdown("filter-operator", refData.Operators, "", true, false, "(All)");
    this.populateDropdown("filter-usagetype", refData.UsageTypes, "", true, false, "(All)");
    this.populateDropdown("filter-statustype", refData.StatusTypes, "", true, false, "(All)");


    this.resetEditorForm();

    if (refData.UserProfile && refData.UserProfile != null & refData.UserProfile.IsCurrentSessionTokenValid == false) {
        //login info is stale, logout user
        if (this.isUserSignedIn()) {
            this.logEvent("Login info is stale, logging out user.");
            this.logout(false);
        }
    }
};

OCM_App.prototype.populateEditorLatLon = function (result) {
    var lat = result.coords.latitude;
    var lng = result.coords.longitude;

    $("#edit_addressinfo_latitude").val(lat);
    $("#edit_addressinfo_longitude").val(lng);

    //refresh map view
    this.refreshEditorMap(lat, lng);
};

OCM_App.prototype.validateLocationEditor = function () {
    var isValid = true;

    if (isValid == true && $("#edit_addressinfo_title").val().length < 3) {
        this.showMessage("Please provide a descriptive/summary title for this location");
        isValid = false;
    }

    if (isValid == true && $("#edit_addressinfo_latitude").val() == "") {
        this.showMessage("Please provide a valid Latitude or use the lookup button.");
        isValid = false;
    } else if (isValid == true && $("#edit_addressinfo_longitude").val() == "") {
        this.showMessage("Please provide a valid Longitude or use the lookup button.");
        isValid = false;
    }
    return isValid;
};

OCM_App.prototype.performLocationSubmit = function () {

    var refData = this.ocm_data.referenceData;
    var item = this.ocm_data.referenceData.ChargePoint;

    if (this.isLocationEditMode == true) item = this.selectedPOI;

    //collect form values
    item.AddressInfo.Title = $("#edit_addressinfo_title").val();
    item.AddressInfo.AddressLine1 = $("#edit_addressinfo_addressline1").val();
    item.AddressInfo.AddressLine2 = $("#edit_addressinfo_addressline2").val();
    item.AddressInfo.Town = $("#edit_addressinfo_town").val();
    item.AddressInfo.StateOrProvince = $("#edit_addressinfo_stateorprovince").val();
    item.AddressInfo.Postcode = $("#edit_addressinfo_postcode").val();
    item.AddressInfo.Latitude = $("#edit_addressinfo_latitude").val();
    item.AddressInfo.Longitude = $("#edit_addressinfo_longitude").val();

    var country = this.ocm_data.getRefDataByID(refData.Countries, $("#edit_addressinfo_countryid").val());
    item.AddressInfo.Country = country;

    item.AddressInfo.AccessComments = $("#edit_addressinfo_accesscomments").val();
    item.AddressInfo.ContactTelephone1 = $("#edit_addressinfo_contacttelephone1").val();
    item.AddressInfo.ContactTelephone2 = $("#edit_addressinfo_contacttelephone2").val();
    item.AddressInfo.ContactEmail = $("#edit_addressinfo_contactemail").val();
    item.AddressInfo.RelatedURL = $("#edit_addressinfo_relatedurl").val();

    item.NumberOfPoints = $("#edit_numberofpoints").val();
    item.UsageType = this.ocm_data.getRefDataByID(refData.UsageTypes, $("#edit_usagetype").val());
    item.UsageCost = $("#edit_usagecost").val();
    item.StatusType = this.ocm_data.getRefDataByID(refData.StatusTypes, $("#edit_statustype").val());
    item.GeneralComments = $("#edit_generalcomments").val();
    item.OperatorInfo = this.ocm_data.getRefDataByID(refData.Operators, $("#edit_operator").val());

    if (this.isLocationEditMode != true) {
        item.DataProvider = null;

        //if user is editor for this location, set to publish on submit
        if (this.hasUserPermissionForPOI(item, "Edit")) {
            item.SubmissionStatus = this.ocm_data.getRefDataByID(refData.SubmissionStatusTypes, 200);
        }
    } else {
        //in edit mode use submission status from form
        item.SubmissionStatus = this.ocm_data.getRefDataByID(refData.SubmissionStatusTypes, $("#edit_submissionstatus").val());
        item.DataProvider = this.ocm_data.getRefDataByID(refData.DataProviders, $("#edit_dataprovider").val());
    }

    item.Connections = new Array(); //clear templated connection info

    //read settings from connection editors
    var numConnections = 0;
    for (var n = 1; n <= this.numConnectionEditors; n++) {
        var connectionInfo = {
            "ID": -1,
            "Reference": null,
            "ConnectionType": this.ocm_data.getRefDataByID(refData.ConnectionTypes, $("#edit_connection" + n + "_connectiontype").val()),
            "StatusType": this.ocm_data.getRefDataByID(refData.StatusTypes, $("#edit_connection" + n + "_status").val()),
            "Level": this.ocm_data.getRefDataByID(refData.ChargerTypes, $("#edit_connection" + n + "_level").val()),
            "CurrentType": this.ocm_data.getRefDataByID(refData.CurrentTypes, $("#edit_connection" + n + "_currenttype").val()),
            "Amps": $("#edit_connection" + n + "_amps").val(),
            "Voltage": $("#edit_connection" + n + "_volts").val(),
            "PowerKW": $("#edit_connection" + n + "_powerkw").val(),
            "Quantity": $("#edit_connection" + n + "_quantity").val()
        };

        var $connection = $("#edit_connection" + n);

        var currentID = null;
        if ($.mobile) {
            currentID = $connection.jqmData("_connection_id");
        } else {
            currentID = jQuery.data($connection, "_connection_id");
        }
        if (currentID > 0) {
            connectionInfo.ID = parseInt(currentID);
        }

        //add only non-blank connection info
        if (
			(connectionInfo.Reference != null && connectionInfo.Reference != "")
			|| connectionInfo.Amps != ""
			|| connectionInfo.Voltage != ""
            || connectionInfo.PowerKW != ""
			|| (connectionInfo.ConnectionType != null && connectionInfo.ConnectionType.ID > 0)
			|| (connectionInfo.StatusType != null && connectionInfo.StatusType.ID > 0)
			|| (connectionInfo.Level != null && connectionInfo.Level.ID > 1)
			|| (connectionInfo.Quantity != null && connectionInfo.Quantity > 1)
            || (connectionInfo.CurrentType != null && connectionInfo.CurrentType.ID > 0)
			) {
            item.Connections.push(connectionInfo);
            numConnections++;
        }

    }

    //set legacy overall charger type
    //if (item.Chargers != null) {
    //item.Chargers[0].ChargerType = this.ocm_data.getRefDataByID(refData.ChargerTypes, $("#edit_connection1_level").val());
    //}

    //show progress
    this.showProgressIndicator();

    //submit
    this.ocm_data.submitLocation(item, this.getLoggedInUserInfo(), $.proxy(this.submissionCompleted, this), $.proxy(this.submissionFailed, this));
};

OCM_App.prototype.showLocationEditor = function () {

    this.resetEditorForm();

    //populate editor with currently selected poi
    if (this.selectedPOI != null) {
        this.isLocationEditMode = true;
        var poi = this.selectedPOI;

        $("#edit_addressinfo_title").val(poi.AddressInfo.Title);
        $("#edit_addressinfo_addressline1").val(poi.AddressInfo.AddressLine1);
        $("#edit_addressinfo_addressline2").val(poi.AddressInfo.AddressLine2);
        $("#edit_addressinfo_town").val(poi.AddressInfo.Town);
        $("#edit_addressinfo_stateorprovince").val(poi.AddressInfo.StateOrProvince);
        $("#edit_addressinfo_postcode").val(poi.AddressInfo.Postcode);
        this.setDropdown("edit_addressinfo_countryid", poi.AddressInfo.Country.ID);
        $("#edit_addressinfo_latitude").val(poi.AddressInfo.Latitude);
        $("#edit_addressinfo_longitude").val(poi.AddressInfo.Longitude);
        $("#edit_addressinfo_accesscomments").val(poi.AddressInfo.AccessComments);
        $("#edit_addressinfo_contacttelephone1").val(poi.AddressInfo.ContactTelephone1);
        $("#edit_addressinfo_contacttelephone2").val(poi.AddressInfo.ContactTelephone2);
        $("#edit_addressinfo_contactemail").val(poi.AddressInfo.ContactEmail);
        $("#edit_addressinfo_relatedurl").val(poi.AddressInfo.RelatedURL);

        $("#edit_numberofpoints").val(poi.NumberOfPoints);
        $("#edit_usagecost").val(poi.UsageCost);
        $("#edit_generalcomments").val(poi.GeneralComments);

        this.setDropdown("edit_usagetype", poi.UsageType != null ? poi.UsageType.ID : "0");
        this.setDropdown("edit_statustype", poi.StatusType != null ? poi.StatusType.ID : "50");
        this.setDropdown("edit_submissionstatus", poi.SubmissionStatus != null ? poi.SubmissionStatus.ID : "1");
        this.setDropdown("edit_operator", poi.OperatorInfo != null ? poi.OperatorInfo.ID : "1");
        this.setDropdown("edit_dataprovider", poi.DataProvider != null ? poi.DataProvider.ID : "1");

        //show edit-only mode dropdowns
        $("#edit-submissionstatus-container").show();
        $("#edit-operator-container").show();
        $("#edit-dataprovider-container").show();

        //populate connection editor(s)
        if (poi.Connections != null) {
            for (var n = 1; n <= this.numConnectionEditors; n++) {

                var $connection = ($("#edit_connection" + n));

                if (poi.Connections.length >= n) {

                    //create editor section
                    var con = poi.Connections[n - 1];
                    if (con != null) {
                        if ($connection.length > 0) {
                            //populate connection editor
                            this.setDropdown("edit_connection" + n + "_connectiontype", con.ConnectionType != null ? con.ConnectionType.ID : "0");
                            this.setDropdown("edit_connection" + n + "_level", con.Level != null ? con.Level.ID : "");
                            this.setDropdown("edit_connection" + n + "_status", con.StatusType != null ? con.StatusType.ID : "0");
                            this.setDropdown("edit_connection" + n + "_currenttype", con.CurrentType != null ? con.CurrentType.ID : "");

                            $("#edit_connection" + n + "_amps").val(con.Amps);
                            $("#edit_connection" + n + "_volts").val(con.Voltage);
                            $("#edit_connection" + n + "_quantity").val(con.Quantity);
                            $("#edit_connection" + n + "_powerkw").val(con.PowerKW);

                            if ($.mobile) {
                                $connection.jqmData("_connection_id", con.ID);
                            } else {
                                jQuery.data($connection, "_connection_id", con.ID);
                            }

                            //expand editor by default
                           
                            $connection.collapse('show')
                        }
                    }
                } else {
                    //null data (if present) from connection editor
                    if ($.mobile) {
                        $connection.jqmData("_connection_id", 0);
                        //collapse editor by default
                        $connection.trigger("collapse");
                    } else {
                        jQuery.data($connection, "_connection_id", 0);
                        $connection.collapse('hide')
                    }
                }
            }
        }
    }

};

OCM_App.prototype.refreshEditorMap = function (currentLat, currentLng) {
    this.initEditorMap(currentLat, currentLng);
};

OCM_App.prototype.initEditorMap = function (currentLat, currentLng) {

    if (this.editorMapInitialised === false) {

        this.editorMapInitialised = true;
        var editPos = google.maps.LatLng(currentLat, currentLng);

        var editMapOptions = {
            zoom: 16,
            center: editPos,
            panControl: true,
            zoomControl: true,
            scaleControl: true,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };

        // Create map object with options

        this.editorMap = new google.maps.Map(document.getElementById("editor_map_canvas"), editMapOptions);

        this.editMarker = new google.maps.Marker({
            map: ocm_app.editorMap,
            draggable: true,
            position: editPos
        });

        // register event to catch marker drag end
        google.maps.event.addListener(this.editMarker, 'dragend', function () {

            var point = ocm_app.editMarker.getPosition();
            //centre map on dragged marker
            ocm_app.editorMap.panTo(point);

            // Update the lat/lng in editor
            $("#edit_addressinfo_latitude").val(point.lat());
            $("#edit_addressinfo_longitude").val(point.lng());

            //TODO: lookup address title for pos as well?
        });

        //$("#editor_map_canvas").show();
        google.maps.event.trigger(ocm_app.editorMap, 'resize');
    } else {

        //var point = ocm_app.editMarker.getPosition();
        //ocm_app.editorMap.panTo(point);
    }

};