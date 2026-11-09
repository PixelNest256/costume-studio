import React from 'react';
import PropTypes from 'prop-types';
import {useIntl} from 'react-intl';

const StrokeToggle = ({checked, disabled, onChange}) => {
    const intl = useIntl();
    return (
        <input
            aria-label={intl.formatMessage({
                id: 'paint.paintEditor.strokeToggle',
                defaultMessage: 'Hide outline'
            })}
            checked={checked}
            className="stroke-toggle"
            disabled={disabled}
            onChange={event => onChange(event.target.checked)}
            title={intl.formatMessage({
                id: 'paint.paintEditor.strokeToggleHint',
                defaultMessage: 'Hide the outline while keeping its color and width'
            })}
            type="checkbox"
        />
    );
};

StrokeToggle.propTypes = {
    checked: PropTypes.bool.isRequired,
    disabled: PropTypes.bool,
    onChange: PropTypes.func.isRequired
};

StrokeToggle.defaultProps = {
    disabled: false
};

export default StrokeToggle;
