import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {useIntl} from 'react-intl';

import Button from '../button/button.jsx';
import Dropdown from '../dropdown/dropdown.jsx';
import InputGroup from '../input-group/input-group.jsx';
import ButtonGroup from '../button-group/button-group.jsx';
import Fonts from '../../lib/fonts';
import styles from './font-dropdown.css';

const ModeToolsComponent = props => {
    const intl = useIntl();
    const selectedCustom = (props.customFonts || []).find(entry =>
        entry.family === props.font || entry.legacyFamily === props.font);
    return (
        <Dropdown
        className={classNames(styles.modUnselect, styles.fontDropdown)}
        enterExitTransitionDurationMs={60}
        popoverContent={
            <InputGroup className={styles.modContextMenu}>
                <Button
                    className={classNames(styles.modMenuItem)}
                    onClick={props.onChoose}
                    onMouseOver={props.onHoverSansSerif}
                >
                    <span className={styles.sansSerif}>
                        {props.getFontName(Fonts.SANS_SERIF)}
                    </span>
                </Button>
                <Button
                    className={classNames(styles.modMenuItem)}
                    onClick={props.onChoose}
                    onMouseOver={props.onHoverSerif}
                >
                    <span className={styles.serif}>
                        {props.getFontName(Fonts.SERIF)}
                    </span>
                </Button>
                <Button
                    className={classNames(styles.modMenuItem)}
                    onClick={props.onChoose}
                    onMouseOver={props.onHoverHandwriting}
                >
                    <span className={styles.handwriting}>
                        {props.getFontName(Fonts.HANDWRITING)}
                    </span>
                </Button>
                <Button
                    className={classNames(styles.modMenuItem)}
                    onClick={props.onChoose}
                    onMouseOver={props.onHoverMarker}
                >
                    <span className={styles.marker}>
                        {props.getFontName(Fonts.MARKER)}
                    </span>
                </Button>
                <Button
                    className={classNames(styles.modMenuItem)}
                    onClick={props.onChoose}
                    onMouseOver={props.onHoverCurly}
                >
                    <span className={styles.curly}>
                        {props.getFontName(Fonts.CURLY)}
                    </span>
                </Button>
                <Button
                    className={classNames(styles.modMenuItem)}
                    onClick={props.onChoose}
                    onMouseOver={props.onHoverPixel}
                >
                    <span className={styles.pixel}>
                        {props.getFontName(Fonts.PIXEL)}
                    </span>
                </Button>
                <Button
                    className={classNames(styles.modMenuItem)}
                    onClick={props.onChoose}
                    onMouseOver={props.onHoverChinese}
                >
                    <span className={styles.chinese}>
                        {props.getFontName(Fonts.CHINESE)}
                    </span>
                </Button>
                <Button
                    className={classNames(styles.modMenuItem)}
                    onClick={props.onChoose}
                    onMouseOver={props.onHoverJapanese}
                >
                    <span className={styles.japanese}>
                        {props.getFontName(Fonts.JAPANESE)}
                    </span>
                </Button>
                <Button
                    className={classNames(styles.modMenuItem)}
                    onClick={props.onChoose}
                    onMouseOver={props.onHoverKorean}
                >
                    <span className={styles.korean}>
                        {props.getFontName(Fonts.KOREAN)}
                    </span>
                </Button>
                {(props.customFonts || []).map(font => (
                    <Button
                        className={styles.modMenuItem}
                        key={font.id}
                        onClick={() => props.onChooseCustomFont(font.family)}
                        title={font.fallback ? `${font.name} (fallback: ${font.fallback})` : font.name}
                    >
                        <span style={{fontFamily: `"${font.family}"`}}>{font.name}</span>
                    </Button>
                ))}
                <ButtonGroup className={styles.fontManagerControls}>
                    <Button className={styles.modMenuItem} onClick={props.onManageFonts}>
                        {intl.formatMessage({id: 'font.addMore', defaultMessage: 'Add more fonts…'})}
                    </Button>
                </ButtonGroup>
            </InputGroup>
        }
        ref={props.componentRef}
        tipSize={.01}
        onOpen={props.onOpenDropdown}
        onOuterAction={props.onClickOutsideDropdown}
    >
        <span
            className={classNames(props.getFontStyle(props.font), styles.displayedFontName)}
            style={selectedCustom ? {fontFamily: `"${props.font}"`} : undefined}
        >
            {props.getFontName(props.font)}
        </span>
        </Dropdown>
    );
};

ModeToolsComponent.propTypes = {
    componentRef: PropTypes.func.isRequired,
    font: PropTypes.string,
    getFontName: PropTypes.func.isRequired,
    getFontStyle: PropTypes.func.isRequired,
    onChoose: PropTypes.func.isRequired,
    onClickOutsideDropdown: PropTypes.func,
    onHoverChinese: PropTypes.func,
    onHoverCurly: PropTypes.func,
    onHoverHandwriting: PropTypes.func,
    onHoverJapanese: PropTypes.func,
    onHoverKorean: PropTypes.func,
    onHoverMarker: PropTypes.func,
    onHoverPixel: PropTypes.func,
    onHoverSansSerif: PropTypes.func,
    onHoverSerif: PropTypes.func,
    onOpenDropdown: PropTypes.func,
    onManageFonts: PropTypes.func,
    customFonts: PropTypes.arrayOf(PropTypes.shape({id: PropTypes.string.isRequired, name: PropTypes.string.isRequired, family: PropTypes.string.isRequired})),
    onChooseCustomFont: PropTypes.func
};
export default ModeToolsComponent;
