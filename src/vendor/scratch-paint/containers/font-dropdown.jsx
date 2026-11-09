import paper from '@scratch/paper';
import {connect} from 'react-redux';
import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';

import FontDropdownComponent from '../components/font-dropdown/font-dropdown.jsx';
import Fonts from '../lib/fonts';
import {changeFont} from '../reducers/font';
import {getSelectedLeafItems} from '../helper/selection';
import styles from '../components/font-dropdown/font-dropdown.css';

class FontDropdown extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'getFontStyle',
            'getFontName',
            'handleChangeFontSerif',
            'handleChangeFontSansSerif',
            'handleChangeFontHandwriting',
            'handleChangeFontMarker',
            'handleChangeFontCurly',
            'handleChangeFontPixel',
            'handleChangeFontChinese',
            'handleChangeFontJapanese',
            'handleChangeFontKorean',
            'handleOpenDropdown',
            'handleClickOutsideDropdown',
            'setDropdown',
            'handleChoose',
            'handleManageFonts',
            'handleChooseCustomFont'
        ]);
    }
    getFontStyle (font) {
        if ((this.props.customFonts || []).some(entry =>
            entry.family === font || entry.legacyFamily === font)) return '';
        switch (font) {
        case Fonts.SERIF:
            return styles.serif;
        case Fonts.SANS_SERIF:
            return styles.sansSerif;
        case Fonts.HANDWRITING:
            return styles.handwriting;
        case Fonts.MARKER:
            return styles.marker;
        case Fonts.CURLY:
            return styles.curly;
        case Fonts.PIXEL:
            return styles.pixel;
        case Fonts.CHINESE:
            return styles.chinese;
        case Fonts.JAPANESE:
            return styles.japanese;
        case Fonts.KOREAN:
            return styles.korean;
        default:
            return '';
        }
    }
    getFontName (font) {
        const custom = (this.props.customFonts || []).find(entry =>
            entry.family === font || entry.legacyFamily === font);
        if (custom) return custom.name;
        switch (font) {
        case Fonts.CHINESE:
            return '中文';
        case Fonts.KOREAN:
            return '한국어';
        case Fonts.JAPANESE:
            return '日本語';
        default:
            return font;
        }
    }
    handleChangeFontSansSerif () {
        if (this.dropDown.isOpen()) {
            this.props.changeFont(Fonts.SANS_SERIF);
        }
    }
    handleChangeFontSerif () {
        if (this.dropDown.isOpen()) {
            this.props.changeFont(Fonts.SERIF);
        }
    }
    handleChangeFontHandwriting () {
        if (this.dropDown.isOpen()) {
            this.props.changeFont(Fonts.HANDWRITING);
        }
    }
    handleChangeFontMarker () {
        if (this.dropDown.isOpen()) {
            this.props.changeFont(Fonts.MARKER);
        }
    }
    handleChangeFontCurly () {
        if (this.dropDown.isOpen()) {
            this.props.changeFont(Fonts.CURLY);
        }
    }
    handleChangeFontPixel () {
        if (this.dropDown.isOpen()) {
            this.props.changeFont(Fonts.PIXEL);
        }
    }
    handleChangeFontChinese () {
        if (this.dropDown.isOpen()) {
            this.props.changeFont(Fonts.CHINESE);
        }
    }
    handleChangeFontJapanese () {
        if (this.dropDown.isOpen()) {
            this.props.changeFont(Fonts.JAPANESE);
        }
    }
    handleChangeFontKorean () {
        if (this.dropDown.isOpen()) {
            this.props.changeFont(Fonts.KOREAN);
        }
    }
    updateImageAfterFontChange () {
        // Font changes reach the Paper text item through the TextMode
        // componentWillReceiveProps -> TextTool.setFont path. Updating the
        // image in the same tick exported the stale (previous) font, so defer
        // it until the Redux update has been applied to the text items.
        if (this.fontUpdateTimer) window.clearTimeout(this.fontUpdateTimer);
        this.fontUpdateTimer = window.setTimeout(() => {
            this.fontUpdateTimer = null;
            this.props.onUpdateImage();
        }, 0);
    }
    handleChoose () {
        if (this.dropDown.isOpen()) {
            this.dropDown.handleClosePopover();
            this.updateImageAfterFontChange();
        }
    }
    handleChooseCustomFont (font) {
        if (!font) return;
        this.props.changeFont(font);
        if (this.dropDown && this.dropDown.isOpen()) this.dropDown.handleClosePopover();
        this.updateImageAfterFontChange();
    }
    handleManageFonts (event) {
        if (event && event.stopPropagation) event.stopPropagation();
        if (this.dropDown && this.dropDown.isOpen()) this.dropDown.handleClosePopover();
        this.props.onManageFonts();
    }
    handleOpenDropdown () {
        this.savedFont = this.props.font;
        this.savedSelection = getSelectedLeafItems();
    }
    handleClickOutsideDropdown (e) {
        e.stopPropagation();
        this.dropDown.handleClosePopover();

        // Cancel font change
        for (const item of this.savedSelection) {
            if (item instanceof paper.PointText) {
                item.font = this.savedFont;
            }
        }

        this.props.changeFont(this.savedFont);
        this.savedFont = null;
        this.savedSelection = null;
    }
    setDropdown (element) {
        this.dropDown = element;
    }
    componentWillUnmount () {
        if (this.fontUpdateTimer) window.clearTimeout(this.fontUpdateTimer);
    }
    render () {
        return (
            <FontDropdownComponent
                componentRef={this.setDropdown}
                customFonts={this.props.customFonts || []}
                font={this.props.font}
                onChooseCustomFont={this.handleChooseCustomFont}
                getFontName={this.getFontName}
                getFontStyle={this.getFontStyle}
                onChoose={this.handleChoose}
                onClickOutsideDropdown={this.handleClickOutsideDropdown}
                onManageFonts={this.handleManageFonts}
                onHoverChinese={this.handleChangeFontChinese}
                onHoverCurly={this.handleChangeFontCurly}
                onHoverHandwriting={this.handleChangeFontHandwriting}
                onHoverJapanese={this.handleChangeFontJapanese}
                onHoverKorean={this.handleChangeFontKorean}
                onHoverMarker={this.handleChangeFontMarker}
                onHoverPixel={this.handleChangeFontPixel}
                onHoverSansSerif={this.handleChangeFontSansSerif}
                onHoverSerif={this.handleChangeFontSerif}
                onOpenDropdown={this.handleOpenDropdown}
            />
        );
    }
}

FontDropdown.propTypes = {
    changeFont: PropTypes.func.isRequired,
    customFonts: PropTypes.arrayOf(PropTypes.shape({id: PropTypes.string.isRequired, name: PropTypes.string.isRequired, family: PropTypes.string.isRequired})),
    font: PropTypes.string,
    onManageFonts: PropTypes.func,
    onUpdateImage: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
    font: state.scratchPaint.font
});
const mapDispatchToProps = dispatch => ({
    changeFont: font => {
        dispatch(changeFont(font));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(FontDropdown);
