module powerbi.extensibility.visual {
    import IViewport = powerbi.IViewport;
    export class KPITicker implements IVisual {
        // stores the entire data that is selected by the user
        private static oData: DataViewTableRow[];
        // stores the index of data which is to be added next
        private static iCurrentPosition = 0;
        // number of KPI that is to be shown at a time. Possible values : 1, 2, 3, 4
        private static iNumberOfKPI: number;
        // stores the dataView of the visual
        private static oDataView: DataView;
        // stores the font size of elements of the visual
        private static iFontSize: number;
        // stores the font color of elements of the visual
        private static iFontColor: Fill;
        // stores the background color of the container
        private static iBackgroundColor: Fill;
        // stores the height of the container
        private static iHeightOfContainer: number;
        // stores the value of time for which current data will appear
        private static iDelay: number;
        // stores the value of time after which next data will appear
        private static iDuration: number;
        // stores the index of meaure KPI Status
        private static iIndexOfStatus: number;
        // stores the index of category KPI Nane
        private static iIndexOfName: number;
        // stores the index of measure KPI Last Value
        private static iIndexOfLastValue: number;
        // stores the index of measure KPI Current Value 
        private static iIndexOfCurrentValue: number;
        // stores the interval value
        private static iInterval: number;
        // stores the timeout value
        private static iTimeout: number;
        // stores the color for positive indicator
        private static iPositiveIndicatorColor: Fill;
        // stores the color for negative indicator
        private static iNegativeIndicatorColor: Fill;
        // stores the color for neutral indicator
        private static iNeutralIndicatorColor: Fill;
        // stores the flag variable to check if index is exceeding the length of data
        private static bFlag: boolean;
        // stores the index to check if index is exceeding data length
        private static iCheckIndex: number;
        // tells where to continue from in case the index exceeds data length
        private static iFlagIndex: number;
        // stores if change percentage is to be shown or not
        private static iEnableDelta: number;
        // stores the information if the visual is updated or not
        private static bIsUpdated: boolean;
        private static viewport: IViewport;

        /*
        * Creates instance of KPIIndicator. This method is only called once.
        * @param {VisualConstructorOptions} options - Contains references to the element that will
        *                                             contain the visual and a reference to the host
        *                                             which contains services.
        * 
        */
        constructor(options: VisualConstructorOptions) {
            // this is to make the parent container
            d3.select(options.element).append('div').attr('id', 'mainWrapper');
            $('<div>').attr('id', 'wrapper').appendTo('#mainWrapper');

            // initializing iDelay to 1200ms
            KPITicker.iDelay = 1200;
            // initializing iDuration to 4000ms
            KPITicker.iDuration = 4000;
            // initializing the height of containers to 80
            KPITicker.iHeightOfContainer = 80;
            // initializing iInterval and iTimeout to -1 so that they are not cleared the first time visual is loaded
            KPITicker.iInterval = -1;
            KPITicker.iTimeout = -1;
        }
        /*
        * function to updates the state of the visual. Every sequential databinding and resize will call update.
        * @param {VisualUpdateOptions} options - Contains references to the size of the container
        *                                        and the dataView which contains all the data
        *                                        the visual had queried.
        */
        public update(options: VisualUpdateOptions) {
            KPITicker.viewport = options.viewport;
            //clear interval and timeout when update is called
            if (KPITicker.iInterval != -1) {
                window.clearTimeout(KPITicker.iInterval);
            }
            if (KPITicker.iTimeout != -1) {
                window.clearTimeout(KPITicker.iTimeout);
            }

            // check if basic requirements are satisfied else return
            if (options.dataViews.length === 0 || !options.dataViews[0].categorical || ((!options.dataViews[0].categorical.categories) || (!options.dataViews[0].categorical.values))) {
                KPITicker.displayBasicRequirement(1);
                return;
            }

            // initializing KPITicker.iCurrentPosition to zero
            KPITicker.iCurrentPosition = 0;

            // to pass dataView as a parameter when formatting options are choosen
            KPITicker.oDataView = options.dataViews[0];
            let oDataCategorical = KPITicker.oDataView.categorical;
            let iNumberOfValues = oDataCategorical.values.length;
            let iNumberOfCategories = oDataCategorical.categories.length;

            // initializing the KPITIcker.iIndexOfName, KPITIcker.iIndexOfStatus, KPITIcker.iIndexOfLastValue,KPITIcker.iIndexOfCurrentValue to -1 so that if they are not selected by user the value corresponding to them is not displayed
            KPITicker.iIndexOfName = -1
            KPITicker.iIndexOfStatus = -1;
            KPITicker.iIndexOfLastValue = -1;
            KPITicker.iIndexOfCurrentValue = -1;

            // assigning proper index for category KPI Name
            for (iIndex = 0; iIndex < iNumberOfCategories; iIndex++) {
                if (oDataCategorical.categories[iIndex].source.roles["kpiName"]) {
                    KPITicker.iIndexOfName = iIndex;
                    break;
                }
            }
            // assigning proper index for measures
            for (iIndex = 0; iIndex < iNumberOfValues; iIndex++) {
                // assigning index for measure KPI Current Value
                if (oDataCategorical.values[iIndex].source.roles["kpiCurrentValue"]) {
                    KPITicker.iIndexOfCurrentValue = iIndex;
                }
                // assigning index for measure KPI Last Value
                else if (oDataCategorical.values[iIndex].source.roles["kpiLastValue"]) {
                    KPITicker.iIndexOfLastValue = iIndex;
                }
                // assigning index for measure KPI Status
                else if (oDataCategorical.values[iIndex].source.roles["kpiStatus"]) {
                    KPITicker.iIndexOfStatus = iIndex;
                }
            }

            // if KPI current value or KPI name is not selected
            if (KPITicker.iIndexOfCurrentValue === -1 || KPITicker.iIndexOfName === -1) {
                KPITicker.displayBasicRequirement(1);
                return;
            }

            // if status column has values other than -1,0 and 1
            if (KPITicker.iIndexOfStatus != -1) {
                var oStatusData = KPITicker.oDataView.categorical.values[KPITicker.iIndexOfStatus].values
                var iLengthOfData = oStatusData.length;
                for (iIndex = 0; iIndex < iLengthOfData; iIndex++) {
                    if (oStatusData[iIndex] === null || !(oStatusData[iIndex] === 1 || oStatusData[iIndex] === -1 || oStatusData[iIndex] === 0)) {
                        KPITicker.displayBasicRequirement(2);
                        return;
                    }
                }
            }

            // storing all the data in one variable
            KPITicker.oData = KPITicker.oDataView.table.rows;

            // empty the main div when update is called
            $('#wrapper').empty();

            var iIndex = 0;
            var iDivStart = 1;

            // The number of containers. Possible values 1,2,3,4
            KPITicker.iNumberOfKPI = KPITicker.getValue(KPITicker.oDataView, 'numberOfKPI');
            if (KPITicker.iNumberOfKPI > 4) {
                KPITicker.iNumberOfKPI = 4;
            }
            else if (KPITicker.iNumberOfKPI < 1) {
                KPITicker.iNumberOfKPI = 1;
            }
            if (KPITicker.oData.length < KPITicker.iNumberOfKPI) {
                KPITicker.iNumberOfKPI = KPITicker.oData.length;
            }
            // if KPITicker.iNumberOfKPI is still 0 that means there is no data after filters are applied
            if (KPITicker.iNumberOfKPI === 0) {
                KPITicker.displayBasicRequirement(0);
                return;
            }
            // The font size of containers. We are normalizing it to be 12 at max as height is not changeable
            KPITicker.iFontSize = KPITicker.getValue(KPITicker.oDataView, 'fontSize');
            KPITicker.iFontSize = (12 * KPITicker.iFontSize) / 40;

            // Status of show change percentage
            KPITicker.iEnableDelta = KPITicker.getValue(KPITicker.oDataView, 'enableDelta');
            // The font color of container
            KPITicker.iFontColor = KPITicker.getFill(KPITicker.oDataView, 'fontColor');

            // The background color of containers
            KPITicker.iBackgroundColor = KPITicker.getFill(KPITicker.oDataView, 'backgroundColor');

            // The color of positive indicator
            KPITicker.iPositiveIndicatorColor = KPITicker.getFill(KPITicker.oDataView, 'positiveIndicatorColor');

            // The color of negative indicator
            KPITicker.iNegativeIndicatorColor = KPITicker.getFill(KPITicker.oDataView, 'negativeIndicatorColor');

            // The color of neutral indicator
            KPITicker.iNeutralIndicatorColor = KPITicker.getFill(KPITicker.oDataView, 'neutralIndicatorColor');

            // creating wrapper1 initially to start the visual
            KPITicker.createWrapper(1);
            // change the top of wrapper1 to initially show it on the screen
            $('#wrapper1').css('top', '0px');
            iDivStart = 1;
            // the visual is updated
            KPITicker.bIsUpdated = true;
            // populating the wrapper1 that was created
            KPITicker.populateWrapper(1, iDivStart);

            // change the value of KPITIcker.iCurrentPosition to number of containers
            KPITicker.iCurrentPosition = KPITicker.iNumberOfKPI;
            // call add next data in fixed timeout only if some slicer is not applied or the number of data is equal to the number of containers.
            if (!(KPITicker.iNumberOfKPI === KPITicker.oData.length)) {
                KPITicker.iInterval = setTimeout(KPITicker.addNextData, KPITicker.iDuration);
            }
        }
        /*
        * method to display text if basic requirements are not satisfied
        */
        private static displayBasicRequirement(iStatus: number) {
            $('#wrapper').empty();
            $('<p>').attr('id', 'textToDisplay').appendTo('#wrapper');
            if (iStatus === 1) {
                document.getElementById('textToDisplay').innerHTML = `Please select 'KPI name' and 'KPI current value' `;
            }
            // if appropriate column for status is not selected
            else if (iStatus === 2) {
                document.getElementById('textToDisplay').innerHTML = `Please select a column with values -1, 0 or 1 for 'KPI status' `;
            }
            // after filters are selected there is no data to display
            else {
                document.getElementById('textToDisplay').innerHTML = `No Data to display `;
            }
        }
        /*
        * method to enumerate through the objects defined in the capabilities and adds the properties to the format pane
        * @param {EnumerateVisualObjectInstancesOptions} options - Map of defined objects
        */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            let oObjectName = options.objectName;
            let oObjectEnumeration: VisualObjectInstance[] = [];
            var oDataView = KPITicker.oDataView;
            switch (oObjectName) {
                // enumerate containers object from capabilities.json
                case 'configuration':
                    var oConfiguration: VisualObjectInstance = {
                        objectName: 'configuration',
                        displayName: 'Configuration',
                        selector: null,
                        properties: {
                            numberOfKPI: KPITicker.iNumberOfKPI,
                            enableDelta: KPITicker.getValue(oDataView, 'enableDelta'),
                            fontSize: KPITicker.getValue(oDataView, 'fontSize'),
                            fontColor: KPITicker.getFill(oDataView, 'fontColor'),
                            backgroundColor: KPITicker.getFill(oDataView, 'backgroundColor'),
                        }
                    };
                    oObjectEnumeration.push(oConfiguration);
                    break;
                // enumerate indicators object from capabilities.json
                case 'indicators':
                    var oIndicators: VisualObjectInstance = {
                        objectName: 'indicators',
                        displayName: 'Indicators',
                        selector: null,
                        properties: {
                            positiveIndicatorColor: KPITicker.getFill(oDataView, 'positiveIndicatorColor'),
                            negativeIndicatorColor: KPITicker.getFill(oDataView, 'negativeIndicatorColor'),
                            neutralIndicatorColor: KPITicker.getFill(oDataView, 'neutralIndicatorColor')
                        }
                    };
                    oObjectEnumeration.push(oIndicators);
                    break;
            }
            return oObjectEnumeration;
        }

        /*
        * method to get the color of font or background whichever is needed
        * @param {DataView} oDataView - contains the DataView of options
        * @param {string} sKey - name of property whose value is needed
        */
        private static getFill(oDataView: DataView, sKey: string): Fill {
            if (oDataView) {
                var oObjects = oDataView.metadata.objects;
                if (oObjects) {
                    // return appropriate value as per the formatting options selected
                    var oConfiguration = oObjects['configuration'];
                    if (oConfiguration) {
                        var oFill = <Fill>oConfiguration[sKey];
                        if (oFill)
                            return oFill.solid.color;
                    }
                    var oIndicators = oObjects['indicators'];
                    if (oIndicators) {
                        var oFill = <Fill>oIndicators[sKey];
                        if (oFill)
                            return oFill.solid.color;
                    }
                }
            }
            // if no value is choosen set default values
            if ('fontColor' === sKey) {
                return "#043c74";
            }
            else if ('backgroundColor' === sKey) {
                return "#efefef";
            }
            else if ('positiveIndicatorColor' === sKey) {
                return "#009900";
            }
            else if ('negativeIndicatorColor' === sKey) {
                return "#ff0000";
            }
            else if ('neutralIndicatorColor' === sKey) {
                return '#0000ff';
            }
        }

        /*
        * method to get the value of font size or number of containers whichever is needed
        * @param {DataView} oDataView - contains the DataView of options
        * @param {string} sKey - name of property whose value is needed
        */
        private static getValue(oDataView: DataView, sKey: string): number {

            if (oDataView) {
                var oObjects = oDataView.metadata.objects;
                if (oObjects) {
                    var oConfiguration = oObjects['configuration'];
                    if (oConfiguration) {
                        var iValue = <number>oConfiguration[sKey];
                        if (iValue != null)
                            return iValue;
                    }
                }
            }
            // if no value is choosen set default values
            if ('numberOfKPI' === sKey) {
                return 4;
            }
            if ('fontSize' === sKey) {
                return 35;
            }
            if ('enableDelta' === sKey) {
                return 0;
            }
        }
        /*
        * method to decide which class is to be used for what div and append html elements accordingly
        * @param {DataView} oDataView - contains the DataView of options
        * @param {string} sClassNames - class names that are to be applied to the div
        * @param {number} iIndicator - to tell if the value to be displayed is Change Percentage or Change Value
        * @param {number} iIndex - index of the data row whose value is to be populated
        */
        private static appendData(oDataView: DataView, sClassNames: string, iIndicator: number, iIndex: number) {
            let sAppendString, sValueDisplayed: string;
            let iCurrentValue, iLastValue: number;
            sAppendString = "";
            // if iIndicator is 0, the value to be displayed is KPI Change Percentage
            if (iIndicator === 0) {
                if (KPITicker.iIndexOfCurrentValue != -1 && KPITicker.iIndexOfLastValue != -1 && KPITicker.iEnableDelta == 1) {
                    iCurrentValue = <number>oDataView.categorical.values[KPITicker.iIndexOfCurrentValue].values[iIndex];
                    iLastValue = <number>oDataView.categorical.values[KPITicker.iIndexOfLastValue].values[iIndex];
                    // if the last KPI value is 0, then the percentage change should be calculated with denominator as 1
                    if (iLastValue === 0) {
                        sValueDisplayed = (((iCurrentValue - iLastValue) / 1) * 100).toFixed(2);
                    }
                    else {
                        sValueDisplayed = (((iCurrentValue - iLastValue) / iLastValue) * 100).toFixed(2);
                    }
                    sAppendString = `<div class = "` + sClassNames + `" title = "KPI Change Percentage: ` + sValueDisplayed + `%">(` + sValueDisplayed + `%)</div>`;
                }
            }
            // if iIndicator is 1, the value to be displayed is KPI Change Value
            else if (iIndicator === 1) {
                if (KPITicker.iIndexOfLastValue != -1 && KPITicker.iIndexOfCurrentValue != -1) {
                    iCurrentValue = <number>oDataView.categorical.values[KPITicker.iIndexOfCurrentValue].values[iIndex];
                    iLastValue = <number>oDataView.categorical.values[KPITicker.iIndexOfLastValue].values[iIndex];
                    sValueDisplayed = (iCurrentValue - iLastValue).toFixed(2);
                    sAppendString = `<div class = "` + sClassNames + `" title = "KPI Change Value: ` + sValueDisplayed + `">` + sValueDisplayed + `</div>`;
                }
            }
            return sAppendString;
        }
        /*
        * method to decide what indicator is to be used on the basis of status and display statistics about the kpi
        * @param {DataView} oDataView - DataView of the visual
        * @param {number} iIndex - Index of data to be loaded
        */
        private static tliChangeImage(oDataView: DataView, iIndex: number) {
            // to store the status of the data that is being populated
            let iTliStatus: number;
            // the string to append to the innerHTML of the div and the KPI Current value
            let sAppendString, sKPICurrentValue: string;
            sAppendString = "";
            // if KPI Value column is selected populate it
            if (KPITicker.iIndexOfCurrentValue != -1) {
                sKPICurrentValue = <string>oDataView.categorical.values[KPITicker.iIndexOfCurrentValue].values[iIndex];
                sAppendString += `<br> <div class = "tliPrice" title = "KPI Current Value: ` + sKPICurrentValue + `">` + sKPICurrentValue + `</div>`;
            }
            // populate the other details on the basis of selection of Status column
            if (KPITicker.iIndexOfStatus != -1) {
                // storing the value of status of current data to nTliStatus
                iTliStatus = Number(oDataView.categorical.values[KPITicker.iIndexOfStatus].values[iIndex]);
                switch (iTliStatus) {
                    // when nTliStatus is 0 that is no change therefore neutral value
                    case 0:
                        if (KPITicker.iIndexOfCurrentValue != -1) {
                            sAppendString += `<div class = "neutral indicator"></div>`;
                        }
                        sAppendString += KPITicker.appendData(oDataView, "tliChangePriceNeutral tliChange", 1, iIndex);
                        sAppendString += KPITicker.appendData(oDataView, "tliChangeNeutral tliChange", 0, iIndex);
                        break;
                    // when nTliStatus is 1 that is positive change therefore positive value
                    case 1:
                        if (KPITicker.iIndexOfCurrentValue != -1) {
                            sAppendString += `<div class = "arrowUp arrow"> </div>`;
                        }
                        sAppendString += KPITicker.appendData(oDataView, "tliChangePricePositive tliChangePrice", 1, iIndex);
                        sAppendString += KPITicker.appendData(oDataView, "tliChangePositive tliChange", 0, iIndex);
                        break;
                    // when nTliStatus is -1 that is negative change therefore negative value
                    case -1:
                        if (KPITicker.iIndexOfCurrentValue != -1) {
                            sAppendString += `<div class = "arrowDown arrow"> </div>`;
                        }
                        sAppendString += KPITicker.appendData(oDataView, "tliChangePriceNegative tliChangePrice", 1, iIndex);
                        sAppendString += KPITicker.appendData(oDataView, "tliChangeNegative tliChange", 0, iIndex);
                        break;
                }
            }
            // if KPITIcker.iIndexOfStatus is -1
            else {
                sAppendString += KPITicker.appendData(oDataView, "tliChangePrice", 1, iIndex);
                sAppendString += KPITicker.appendData(oDataView, "tliChange", 0, iIndex);
            }
            return sAppendString;
        }

        /*
        * method to load data in the div
        * @param {DataView} oDataView - DataView of the visual
        * @param {number} nDivID - ID of div which is to be loaded
        * @param {number} iIndex - Index of data to be loaded
        */
        private static populateDiv(oDataView: DataView, nDivID: number, iIndex: number) {
            // storing the div name to be used
            var sDivIdName = "container" + nDivID;
            document.getElementById(sDivIdName).innerHTML = ``;
            document.getElementById(sDivIdName).innerHTML = ``;
            // populate name if KPI Name column is selected
            if (KPITicker.iIndexOfName != -1) {
                document.getElementById(sDivIdName).innerHTML = `<div class = "tliName">` + oDataView.categorical.categories[KPITicker.iIndexOfName].values[iIndex] + `</div>`;
            }
            // call tliChangeImage to populate other data for the div
            document.getElementById(sDivIdName).innerHTML += KPITicker.tliChangeImage(KPITicker.oDataView, iIndex);
            $("#" + sDivIdName + " .arrow").css('left', $("#" + sDivIdName + " .tliPrice").outerWidth() + 10);
            $("#" + sDivIdName + " .indicator").css('left', $("#" + sDivIdName + " .tliPrice").outerWidth() + 10);
            $("#" + sDivIdName + " .tliChangePrice").css('left', $("#" + sDivIdName + " .tliPrice").outerWidth() + $("#" + sDivIdName + " .arrow").outerWidth() + 20);
            $("#" + sDivIdName + " .tliChangePriceNeutral").css('left', $("#" + sDivIdName + " .tliPrice").outerWidth() + $("#" + sDivIdName + " .indicator").outerWidth() + 20);

            $("#" + sDivIdName + " .tliChangeNegative").css('left', $("#" + sDivIdName + " .tliChangePrice").outerWidth() + $("#" + sDivIdName + " .tliPrice").outerWidth() + $("#" + sDivIdName + " .arrow").outerWidth() + 20);
            $("#" + sDivIdName + " .tliChangePositive").css('left', $("#" + sDivIdName + " .tliChangePrice").outerWidth() + $("#" + sDivIdName + " .tliPrice").outerWidth() + $("#" + sDivIdName + " .arrow").outerWidth() + 20);
            $("#" + sDivIdName + " .tliChangeNeutral").css('left', $("#" + sDivIdName + " .tliChange").outerWidth() + $("#" + sDivIdName + " .tliPrice").outerWidth() + $("#" + sDivIdName + " .indicator").outerWidth() + 20);
        }

        /*
        * method to create wrapper according to parameter passed.
        * @param {number} iWrapperID  - ID of the wrapper to be created
        */
        private static createWrapper(iWrapperID: number) {
            var sWrapperName = "wrapper" + iWrapperID;
            let sWrapperDivName, sClassOfContainer: string;
            let iStartPoint, iEndPoint: number;
            var iIndex = 0;
            sClassOfContainer = "kpi" + KPITicker.iNumberOfKPI;
            // append the wrapper with appropriate id to "wrapper" div and then change its top so that it is below the existing wrapper
            $('<div>').attr('id', sWrapperName).appendTo('#wrapper');
            $('#' + sWrapperName).css('top', KPITicker.iHeightOfContainer + "px");
            if (iWrapperID === 1) {
                iStartPoint = 1;
                iEndPoint = KPITicker.iNumberOfKPI;
            }
            else if (iWrapperID === 2) {
                iStartPoint = KPITicker.iNumberOfKPI + 1;
                iEndPoint = 2 * KPITicker.iNumberOfKPI;
            }
            // append div to the wrapper just created on the basis of which wrapper id was created and the number of containers
            for (iIndex = iStartPoint; iIndex <= iEndPoint; iIndex++) {
                sWrapperDivName = "container" + iIndex;
                $('<div>').attr('id', sWrapperDivName).appendTo('#' + sWrapperName);
                // changing the width according to number of KPI selected
                var width = KPITicker.viewport.width - 5;
                $('#mainWrapper').width(width + 5);
                if (width < 200 * KPITicker.iNumberOfKPI) {
                    width = 200 * KPITicker.iNumberOfKPI;
                }
                $('#wrapper').width(width + 4);
                $('#' + sWrapperName).width(width + 4);
                $('#' + sWrapperDivName).width((width - 9) / KPITicker.iNumberOfKPI);
            }
        }

        /*
        * method to change the css of containers whenever update is called
        * The css is changed according to the formatting options
        * @param {number} cssDivStart - The id of div from which the wrapper starts
        */
        private static changeCSS(iCssDivStart: number) {
            // change the css according to the number of KPI that are to be displayed at a time
            var iEndPoint = 0;
            var iIndex = 0;
            var sPriceMarginLeft = "10px";
            // to decide how many div are there to change the css
            if (iCssDivStart === 1) {
                iEndPoint = KPITicker.iNumberOfKPI;
            }
            else {
                iEndPoint = 2 * KPITicker.iNumberOfKPI;
            }
            // change the values as per the number of containers selected in the format pane
            switch (KPITicker.iNumberOfKPI) {
                case 1:
                    $('.tliName').addClass('tliNameKPIOne');
                    $('.tliPrice').addClass('tliPriceKPIOne');
                    $('.tliChangePrice').addClass('tliChangePriceKPIOne');
                    $('.tliChange').addClass('tliChangeKPIOne');
                    $('.arrow').addClass('indicatorKPIOne');
                    break;
                case 2:
                    $('.tliName').addClass('tliNameKPITwo');
                    $('.arrow').addClass('indicatorKPITwo');
                    break;
                case 3:
                    $('.tliName').addClass('tliNameKPIThree');
                    $('.arrow').addClass('indicatorKPIThree');
                    break;
            }
            // change the background color of the containers on the basis of 
            for (iIndex = iCssDivStart; iIndex <= iEndPoint; iIndex++) {
                var sDivid = "#container" + iIndex;
                $(sDivid).css('background', <string>KPITicker.iBackgroundColor);
            }
            // change the css on the basis of font size selected in format pane
            $('.tliName').css('font-size', KPITicker.iFontSize + "px");
            $('.tliPrice').css('font-size', KPITicker.iFontSize + "px");
            $('.tliChangePrice').css('font-size', KPITicker.iFontSize + "px");
            $('.tliChange').css('font-size', KPITicker.iFontSize + "px");
            // change the css on the basis of font color selected in format pane
            $('.tliName').css('color', <string>KPITicker.iFontColor);
            $('.tliPrice').css('color', <string>KPITicker.iFontColor);
            // change the color of indicators and the font color as per the selection in format pane if the Status column is selected
            if (KPITicker.iIndexOfStatus != -1) {
                $('.arrowDown').css('border-top-color', <string>KPITicker.iNegativeIndicatorColor);
                $('.tliChangeNegative').css('color', <string>KPITicker.iNegativeIndicatorColor);
                $('.tliChangePriceNegative').css('color', <string>KPITicker.iNegativeIndicatorColor);
                $('.neutral').css('background', <string>KPITicker.iNeutralIndicatorColor);
                $('.tliChangeNeutral').css('color', <string>KPITicker.iNeutralIndicatorColor);
                $('.tliChangePriceNeutral').css('color', <string>KPITicker.iNeutralIndicatorColor);
                $('.arrowUp').css('border-bottom-color', <string>KPITicker.iPositiveIndicatorColor);
                $('.tliChangePositive').css('color', <string>KPITicker.iPositiveIndicatorColor);
                $('.tliChangePricePositive').css('color', <string>KPITicker.iPositiveIndicatorColor);
            }
            // if Status column is not selected then the font color is same as KPI Name and KPI Value
            else {
                $('.tliChange').css('color', <string>KPITicker.iFontColor);
                $('.tliChangePrice').css('color', <string>KPITicker.iFontColor);
            }
            // if KPI Value is not selected only show other data with appropriate margin
            if (KPITicker.iIndexOfCurrentValue === -1) {
                $('.tliChangePrice').css('margin-left', sPriceMarginLeft);
            }
        }

        /*
        *method to add next data after duration is over
        */
        private static addNextData() {
            // flag to check if the index has exceeded the data length
            KPITicker.bFlag = true;
            KPITicker.bIsUpdated = false;
            var iIndex = 0;
            var iDivStart = 0;
            // to change the iCurrentPosition value
            KPITicker.iCheckIndex = 0;
            // to start with first value when div is empty but data is not available
            KPITicker.iFlagIndex = 0;
            if (KPITicker.iCurrentPosition != KPITicker.oData.length - 1) {
                KPITicker.iCurrentPosition = KPITicker.iCurrentPosition % (KPITicker.oData.length - 1);
            }
            // if wrapper1 is present, create wrapper2 and remove wrapper1 after animating it.

            if ($('#wrapper1').length) {
                KPITicker.createWrapper(2);
                iDivStart = KPITicker.iNumberOfKPI + 1;
                KPITicker.populateWrapper(2, iDivStart);
            }
            // if wrapper2 is present, create wrapper1 and remove wrapper2 after animating it.
            else {
                KPITicker.createWrapper(1);
                iDivStart = 1;
                KPITicker.populateWrapper(1, iDivStart);
            }
            // check if index has exceeded the length of data and populate accordingly
            if (KPITicker.bFlag) {
                if (KPITicker.iCheckIndex === (KPITicker.oData.length - 1)) {
                    KPITicker.iCurrentPosition = 0;
                }
                else {
                    KPITicker.iCurrentPosition += KPITicker.iNumberOfKPI;
                    if (KPITicker.iCurrentPosition > KPITicker.oData.length - 1) {
                        KPITicker.iCurrentPosition = 0;
                    }
                }
            }
            else {
                KPITicker.iCurrentPosition = KPITicker.iFlagIndex;
            }
            // call addNextData again
            KPITicker.iInterval = setTimeout(KPITicker.addNextData, KPITicker.iDuration);
        }
        /*
        * method to populate wrapper which was created by addNextData and animate it
        * @param {number} iWrapperID - id of the wrapper that was created
        * @param {number} iDivStart - id of the first div in the wrapper created
        */
        private static populateWrapper(iWrapperID: number, iDivStart: number) {

            var iIndex = 0;
            KPITicker.iCheckIndex = 0;
            KPITicker.iFlagIndex = 0;
            KPITicker.bFlag = true;
            for (iIndex = KPITicker.iCurrentPosition; iIndex < KPITicker.iCurrentPosition + KPITicker.iNumberOfKPI; iIndex++) {
                KPITicker.iCheckIndex = iIndex;
                if (iIndex <= KPITicker.oData.length - 1) {
                    KPITicker.populateDiv(KPITicker.oDataView, iDivStart, iIndex);
                }
                else {
                    KPITicker.populateDiv(KPITicker.oDataView, iDivStart, KPITicker.iFlagIndex);
                    KPITicker.iFlagIndex++;
                    KPITicker.bFlag = false;
                }
                iDivStart++;
            }
            var count = 1;
            var height = 80;
            for (count = 1; count <= KPITicker.iNumberOfKPI; count++) {
                if ($('#container' + count + (iWrapperID - 1) * KPITicker.iNumberOfKPI).outerHeight() > height)
                    height = $('#container' + (count + (iWrapperID - 1) * KPITicker.iNumberOfKPI)).outerHeight();
            }
            $('#mainWrapper').height(height + 40);
            for (count = 1; count <= KPITicker.iNumberOfKPI; count++) {
                document.getElementById("container" + (count + (iWrapperID - 1) * KPITicker.iNumberOfKPI)).style.height = (height + 20) + "px";
            }
            // change the css according to the default value or the custom value selected by the user
            KPITicker.changeCSS(iWrapperID);
            //animate the wrappers up only if it is not the first time
            if (!KPITicker.bIsUpdated) {
                KPITicker.animateWrapper(iWrapperID);
            }
        }

        /*
        * method to animate wrapper which was created by addNextData
        * @param {number} iWrapperID - id of the wrapper that was created
        */
        private static animateWrapper(iWrapperID: number) {
            let sWrapperTop, sWrapperBottom: string;
            if (iWrapperID === 1) {
                sWrapperTop = "#wrapper2";
                sWrapperBottom = "#wrapper1";
            }
            else {
                sWrapperTop = "#wrapper1";
                sWrapperBottom = "#wrapper2";
            }

            $(sWrapperTop).animate({ top: "-=" + KPITicker.iHeightOfContainer + "px" }, KPITicker.iDelay).dequeue();
            $(sWrapperBottom).animate({ top: "-=" + KPITicker.iHeightOfContainer + "px" }, KPITicker.iDelay, function () {
                KPITicker.iTimeout = setTimeout(function () {
                    $(sWrapperTop).remove();
                    clearTimeout(KPITicker.iTimeout);
                }, KPITicker.iDelay);
            });
        }
    }
}