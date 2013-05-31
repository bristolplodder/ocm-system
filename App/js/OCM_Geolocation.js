//"use strict";

function OCM_Geolocation() {
	//result for latest client gelocation attempt
	this.clientGeolocationPos = null;

	//input/results for latest text geocoding attempt
	this.geocodingTextInput = null;
	this.geocodingResultPos = null;
}

OCM_Geolocation.prototype.determineUserLocation = function (successCallback, failureCallback) {

	var appContext = this;

	//determine user location automatically if enabled & supported
	if (navigator.geolocation) {

		navigator.geolocation.getCurrentPosition(
	        function (position) {
	        	this.clientGeolocationPos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
	        	successCallback(this.clientGeolocationPos);
	        },
	        function () {
	        	// could not geolocate
	        	appContext.determineUserLocationFailed(failureCallback);
	        }
	    );

	} else if (google.gears) {

		var geo = google.gears.factory.create('beta.geolocation');
		geo.getCurrentPosition(
	            function (position) {
	            	this.clientGeolocationPos = new google.maps.LatLng(position.latitude, position.longitude);
	            	successCallback(this.clientGeolocationPos);
	            },
	            function () {
	            	//could not geolocate
	            	appContext.determineUserLocationFailed(failureCallback);
	            }
	        );

	} else {
		appContext.determineUserLocationFailed(failureCallback);
	}
};

OCM_Geolocation.prototype.determineUserLocationFailed = function (failureCallback) {
	//failed
	failureCallback();
};

OCM_Geolocation.prototype.determineGeocodedLocation = function (locationText, successCallback) {

	//caller is searching for same (previously geocoded) text again, return last result
	if (locationText == this.geocodingTextInput) {
		if (this.geocodingResultPos != null) {
			successCallback(this.geocodingResultPos);
			return false;
		}
	}

	this.geocodingTextInput = locationText;
	this.geocodingResultPos = null;

	var geocoder = new google.maps.Geocoder();
	var appContext = this;

	geocoder.geocode({ 'address': locationText }, function (results, status) {
		if (status == google.maps.GeocoderStatus.OK) {
			var locationPos = results[0].geometry.location;
			appContext.determineGeocodedLocationCompleted(locationPos, successCallback);
		} else {
			alert("Sorry, we could not identify this location: " + status);
		}
	});

	return true;
};

OCM_Geolocation.prototype.determineGeocodedLocationCompleted = function (pos, successCallback) {
	this.geocodingResultPos = pos;
	successCallback(pos);
};

OCM_Geolocation.prototype.getBearing = function (lat1,lon1,lat2,lon2)
{
	//from http://stackoverflow.com/questions/1971585/mapping-math-and-javascript
	
	//convert degrees to radians
	lat1 = lat1 * Math.PI / 180;
	lat2 = lat2 * Math.PI / 180;
	var dLon = (lon2-lon1) * Math.PI / 180;
	var y = Math.sin(dLon) * Math.cos(lat2);
	var x = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
	
	var bearing = Math.atan2(y, x) * 180 / Math.PI;
	if (bearing < 0){
		   bearing = bearing + 360;
	}

	bearing = Math.floor(bearing);
	return bearing;
};

OCM_Geolocation.prototype.getCardinalDirectionFromBearing = function (bearing)
{
	//partly inspired by http://bryan.reynoldslive.com/post/Latitude2c-Longitude2c-Bearing2c-Cardinal-Direction2c-Distance2c-and-C.aspx
	
	if (bearing>=0 && bearing <=22.5) return "N";
	if (bearing>=22.5 && bearing <=67.5) return "NE";
	if (bearing>=67.5 && bearing <=112.5) return "E";
	if (bearing>=112.5 && bearing <=157.5) return "SE";
	if (bearing>=157.5 && bearing <=202.5) return "S";
	if (bearing>=202.5 && bearing <=247.5) return "SW";
	if (bearing>=247.5 && bearing <=292.5) return "W";
	if (bearing>=292.5 && bearing <=337.5) return "NW";
	if (bearing>=337.5 && bearing <=360.1) return "N";
	
	return "?";
};