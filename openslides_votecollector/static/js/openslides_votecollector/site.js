(function() {

'use strict';

angular.module('OpenSlidesApp.openslides_votecollector.site', [
    'OpenSlidesApp.openslides_votecollector',
    'OpenSlidesApp.motions.site'
])

.config([
    'mainMenuProvider',
    'gettext',
    function(mainMenuProvider, gettext) {
        mainMenuProvider.register({
            'ui_sref': 'openslides_votecollector.keypad.list',
            'img_class': 'download',
            'title': gettext('VoteCollector'),
            'weight': 700,
            'perm': 'openslides_votecollector.can_manage_votecollector',
        });
    }
])

.config([
    '$stateProvider',
    function($stateProvider) {
        $stateProvider
        .state('openslides_votecollector', {
            url: '/votecollector',
            abstract: true,
            template: "<ui-view/>",
        })
        .state('openslides_votecollector.keypad', {
            abstract: true,
            template: "<ui-view/>",
        })
        .state('openslides_votecollector.keypad.list', {
            resolve: {
                keypads: function(Keypad) {
                    return Keypad.findAll();
                },
                users: function(User) {
                    return User.findAll();
                },
                seats: function(Seat) {
                    return Seat.findAll();
                }
            }
        })
    }
])

// Service for generic keypad form (create and update)
.factory('KeypadForm', [
    'gettextCatalog',
    'User',
    'Seat',
    function(gettextCatalog, User, Seat) {
        return {
            // ngDialog for keypad form
            getDialog: function(keypad) {
                var resolve = {};
                if (keypad) {
                    resolve = {
                        keypad: function() {
                            return keypad;
                        }
                    }
                }
                return {
                    template: 'static/templates/openslides_votecollector/keypad-form.html',
                    controller: (keypad) ? 'KeypadUpdateCtrl' : 'KeypadCreateCtrl',
                    className: 'ngdialog-theme-default',
                    closeByEscape: false,
                    closeByDocument: false,
                    resolve: (resolve) ? resolve : null
                }
            },
            // angular-formly fields for keypad form
            getFormFields: function() {
                return [
                {
                    key: 'user_id',
                    type: 'select-single',
                    templateOptions: {
                        label: gettextCatalog.getString('Participant'),
                        options: User.getAll(),
                        ngOptions: 'option.id as option.full_name for option in to.options',
                        placeholder: gettextCatalog.getString('(Anonymous)')
                    }
                },
                {
                    key: 'keypad_id',
                    type: 'input',
                    templateOptions: {
                        label: gettextCatalog.getString('Keypad ID'),
                        type: 'number',
                        required: true
                    }
                },
                {
                    key: 'seat_id',
                    type: 'select-single',
                    templateOptions: {
                        label: gettextCatalog.getString('Seat'),
                        options: Seat.getAll(),
                        ngOptions: 'option.id as option.number for option in to.options',
                        placeholder: gettextCatalog.getString('–')
                    }
                }
                ]
            }
        }
    }
])

.controller('KeypadListCtrl', [
    '$scope',
    '$http',
    '$timeout',
    'ngDialog',
    'KeypadForm',
    'Keypad',
    'User',
    'Seat',
    function($scope, $http, $timeout, ngDialog, KeypadForm, Keypad, User, Seat) {
        Keypad.bindAll({}, $scope, 'keypads');
        User.bindAll({}, $scope, 'users');
        Seat.bindAll({}, $scope, 'seats');
        $scope.alert = {};

        // setup table sorting
        $scope.sortColumn = 'keypad_id';
        $scope.reverse = false;
        // function to sort by clicked column
        $scope.toggleSort = function( column ) {
            if ( $scope.sortColumn === column ) {
                $scope.reverse = !$scope.reverse;
            }
            $scope.sortColumn = column;
        };
        // define custom search filter string
        $scope.getFilterString = function(keypad) {
            var seat = '', user = '';
            if (keypad.seat) {
                seat = keypad.seat.number;
            }
            if (keypad.user) {
                user = keypad.user.get_short_name();
            }
            return [
                keypad.keypad_id,
                seat,
                user
            ].join(" ");
        };

        // open new/edit dialog
        $scope.openDialog = function(keypad) {
            ngDialog.open(KeypadForm.getDialog(keypad));
        };
        // open new range dialog
        $scope.openRangeDialog = function() {
            // TODO: ngDialog.open(KeypadRangeForm.getDialog());
        }

        // cancel QuickEdit mode
        $scope.cancelQuickEdit = function(keypad) {
            // revert all changes by restore (refresh) original keypad object from server
            Keypad.refresh(keypad);
            keypad.quickEdit = false;
        };

        // save changed keypad
        $scope.save = function(keypad) {
            Keypad.save(keypad).then(
                function(success) {
                    keypad.quickEdit = false;
                    $scope.alert.show = false;
                },
                function(error){
                    var message = '';
                    for (var e in error.data) {
                        message += e + ': ' + error.data[e] + ' ';
                    }
                    $scope.alert = { type: 'danger', msg: message, show: true };
                });
        };

        // *** delete mode functions ***
        $scope.isDeleteMode = false;
        // check all checkboxes
        $scope.checkAll = function() {
            angular.forEach($scope.keypads, function(keypad) {
                keypad.selected = $scope.selectedAll;
            });
        };
        // uncheck all checkboxes if isDeleteMode is closed
        $scope.uncheckAll = function() {
            if (!$scope.isDeleteMode) {
                $scope.selectedAll = false;
                angular.forEach($scope.keypads, function(keypad) {
                    keypad.selected = false;
                });
            }
        };
        // delete selected keypads
        $scope.deleteMultiple = function() {
            angular.forEach($scope.keypads, function(keypad) {
                if (keypad.selected)
                    Keypad.destroy(keypad.id);
            });
            $scope.isDeleteMode = false;
            $scope.uncheckAll();
        };
        // delete single keypad
        $scope.delete = function(keypad) {
            Keypad.destroy(keypad.id);
        };

        // keypad test
        $scope.checkKeypads = function() {
            $scope.device = null;
            $scope.testing = true;
            $http.get('/votecollector/device/').then(
                function(success) {
                    if (success.data.error) {
                        $scope.device = success.data.error;
                        $scope.testing = false;
                    }
                    else {
                        $scope.device = success.data.device;
                        $http.get('/votecollector/start_ping/').then(
                            function(success) {
                                if (success.data.error) {
                                    $scope.device = success.data.error;
                                }
                                else {
                                    // Stop pinging after 5 seconds.
                                    $timeout(function() {
                                        $http.get('/votecollector/stop_ping/');
                                        $scope.testing = false;
                                    }, 5000);
                                }
                            }
                        );
                     }
                },
                function(failure) {
                    $scope.device = failure.status + ': ' + failure.statusText;
                    $scope.testing = false;
                }
            );
        };
    }
])

.controller('KeypadCreateCtrl', [
    '$scope',
    'Keypad',
    'KeypadForm',
    function($scope, Keypad, KeypadForm) {
        $scope.model = {};
        // get all form fields
        $scope.formFields = KeypadForm.getFormFields();

        // save keypad
        $scope.save = function(keypad) {
            Keypad.create(keypad).then(
                function(success) {
                    $scope.closeThisDialog();
                },
                function(error) {
                    var message = '';
                    for (var e in error.data) {
                        message += e + ': ' + error.data[e] + ' ';
                    }
                    $scope.alert = {type: 'danger', msg: message, show: true};
                }
            );
        };
    }
])

.controller('KeypadUpdateCtrl', [
    '$scope',
    'Keypad',
    'KeypadForm',
    'keypad',
    function($scope, Keypad, KeypadForm, keypad) {
        $scope.alert = {};
        // set initial values for form model by create deep copy of keypad object
        // so list/detail view is not updated while editing
        $scope.model = angular.copy(keypad);

        // get all form fields
        $scope.formFields = KeypadForm.getFormFields();

        // save keypad
        $scope.save = function(keypad) {
            // inject the changed keypad (copy) object back into DS store
            Keypad.inject(keypad);
            // save change keypad object on server
            Keypad.save(keypad).then(
                function(success) {
                    $scope.closeThisDialog();
                },
                function(error) {
                    // save error: revert all changes by restore
                    // (refresh) original keypad object from server
                    Keypad.refresh(keypad);
                    var message = '';
                    for (var e in error.data) {
                        message += e + ': ' + error.data[e] + ' ';
                    }
                    $scope.alert = {type: 'danger', msg: message, show: true};
                }
            );
        };
    }
])

.controller('MotionPollExtUpdateCtrl', [
    '$scope',
    '$http',
    '$timeout',
    'gettextCatalog',
    'MotionPoll',
    'MotionPollForm',
    'Voting',
    'motionpoll',
    'voteNumber',
    function($scope, $http, $timeout, gettextCatalog, MotionPoll, MotionPollForm, Voting, motionpoll, voteNumber) {
        // set initial values for form model by create deep copy of motionpoll object
        // so detail view is not updated while editing poll
        $scope.model = motionpoll; // angular.copy(motionpoll);  // TODO: auto-update?
        $scope.voteNumber = voteNumber;
        $scope.formFields = MotionPollForm.getFormFields();
        $scope.alert = {};

        Voting.setup($scope)

        $scope.toggleVoting = function() {
            if (Voting.isVoting()) {
                Voting.stop();
            }
            else {
                Voting.start();
            }
        }

        // save motionpoll
        $scope.save = function(poll) {
            poll.DSUpdate({
                    motion_id: poll.motion_id,
                    votes: {"Yes": poll.yes, "No": poll.no, "Abstain": poll.abstain},
                    votesvalid: poll.votesvalid,
                    votesinvalid: poll.votesinvalid,
                    votescast: poll.votescast
            })
            .then(function(success) {
                $scope.alert.show = false;
                $scope.closeThisDialog();
            })
            .catch(function(error) {
                var message = '';
                for (var e in error.data) {
                    message += e + ': ' + error.data[e] + ' ';
                }
                $scope.alert = { type: 'danger', msg: message, show: true };
            });
        };

        // TODO: after cancelling a poll votesvalid and votescast are not zero.
    }
])

// mark all votecollector config strings for translation in javascript
.config([
    'gettext',
    function(gettext) {
        // TODO: add gettext config strings
    }
])
}());
