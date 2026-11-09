import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import {useIntl} from 'react-intl';

import Button from '../button/button.jsx';
import {TOOL_SHORTCUTS, withShortcut} from '../../../../lib/shortcuts.js';

import styles from './tool-select-base.css';

const ToolSelectComponent = props => {
    const intl = useIntl();
    const label = intl.formatMessage(props.imgDescriptor);
    const shortcut = TOOL_SHORTCUTS[props.imgDescriptor.id];
    return (
        <Button
            className={
                classNames(props.className, styles.modToolSelect, {
                    [styles.isSelected]: props.isSelected
                })
            }
            data-shortcut={shortcut}
            data-tool-id={props.toolId}
            disabled={props.disabled}
            title={withShortcut(label, shortcut)}
            onClick={props.onMouseDown}
        >
            <img
                alt={label}
                className={styles.toolSelectIcon}
                draggable={false}
                src={props.imgSrc}
            />
        </Button>
    );
};

ToolSelectComponent.propTypes = {
    className: PropTypes.string,
    toolId: PropTypes.string,
    disabled: PropTypes.bool,
    imgDescriptor: PropTypes.shape({
        defaultMessage: PropTypes.string,
        description: PropTypes.string,
        id: PropTypes.string
    }).isRequired,
    imgSrc: PropTypes.string.isRequired,
    isSelected: PropTypes.bool.isRequired,
    onMouseDown: PropTypes.func.isRequired
};

export default ToolSelectComponent;
